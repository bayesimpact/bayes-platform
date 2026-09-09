import type { LanguageModelV3 } from "@ai-sdk/provider"
import { Logger } from "@nestjs/common"
import { asSchema, generateText, Output } from "ai"
import type {
  LLMChatMessage,
  LLMConfig,
  LLMMetadata,
} from "@/common/interfaces/llm-provider.interface"
import { AISDKLLMBuilders } from "@/external/llm/ai-sdk-llm-builders"
import type { CallOrigin } from "@/external/llm/ai-sdk-llm-common"
import { findLeakedToolCalls, type LeakedToolCall } from "@/external/llm/thought-tokens-helper"

export abstract class AISDKLLMToolsMgmt extends AISDKLLMBuilders {
  protected readonly endOfTurnLogger = new Logger("EndOfTurnTools")
  /**
   * A model that VERBALIZES a tool call in the text channel instead of
   * emitting it (documented Gemini failure family) means the tool never
   * ran: the sanitizer hides the tag from the user, so without this log the
   * failure would be completely silent. Logged loudly so monitoring can
   * catch it — a tool with side effects must never fail unnoticed.
   */
  protected readonly leakedToolCallLogger = new Logger("LeakedToolCall")

  /**
   * Guarantees the end-of-turn tools (e.g. mandatory_tool) ran on this turn.
   * They are declared in the answering loop, so a cooperative model (Gemma)
   * calls them in the same generation as its answer — zero extra cost. When
   * the loop finished without calling them (Gemini Flash never volunteers
   * bookkeeping calls), ONE forced generation (toolChoice "required",
   * restricted to the missing tools) runs on top of the produced answer.
   * Already-called tools are skipped so nothing executes twice.
   * "required" is used rather than a named tool_choice because named forcing
   * is silently ignored by the vLLM gemma4 parser on 0.26.0.
   *
   * Best-effort: the user already received the streamed answer, so a failure
   * here is logged but never breaks the stream.
   */
  /**
   * Recovers a tool call the model VERBALIZED in the text channel instead of
   * emitting it (documented Gemini failure family). Without this, the call
   * is simply lost: the sanitizer hides the tag from the user and nothing
   * ran, which silently drops whatever the tool was meant to do.
   *
   * Recovery deliberately does NOT re-force a tool call: the model that
   * leaked is the one that would be asked again, and the whole failure mode
   * is "wrong channel". Instead it uses STRUCTURED OUTPUT (no tool channel
   * involved, arguments grammar-constrained by the schema) to convert the
   * leaked tag — which already carries the intended arguments in a
   * malformed form — into valid input, validated by the tool's own schema
   * before the tool executes.
   *
   * One attempt per tool, skipped when the tool already executed in the
   * turn. Deduplicating repeated deliveries is the destination's job (e.g.
   * the MCP server). Best-effort: the user already got their answer, so
   * failures are logged loudly and never break the stream.
   */
  protected async recoverLeakedToolCalls({
    model,
    config,
    callOrigin,
    metadata,
    functionId,
    leakedToolCalls,
    streamResult,
    tags,
  }: {
    model: LanguageModelV3
    config: LLMConfig
    callOrigin: CallOrigin
    metadata: LLMMetadata
    functionId: string
    leakedToolCalls: LeakedToolCall[]
    streamResult: {
      steps: PromiseLike<Array<{ toolResults: Array<{ toolName: string; output: unknown }> }>>
    }
    tags: string[]
  }): Promise<void> {
    if (leakedToolCalls.length === 0) return
    const tools = config.tools
    if (!tools) return

    try {
      const steps = await streamResult.steps
      const executedToolNames = new Set(
        steps.flatMap((step) => step.toolResults.map((toolResult) => toolResult.toolName)),
      )

      for (const leakedCall of leakedToolCalls) {
        if (executedToolNames.has(leakedCall.name)) continue
        const tool = tools[leakedCall.name]
        if (!tool?.execute) {
          this.leakedToolCallLogger.error(
            `cannot recover leaked call to "${leakedCall.name}": tool not declared or not executable`,
          )
          continue
        }

        const recoveredInput = await generateText({
          model,
          temperature: config.temperature,
          messages: [
            {
              role: "user",
              content: `A tool call was emitted as malformed text instead of a real tool call. Convert it into the tool's arguments, verbatim — copy every value exactly as written, invent nothing, and drop nothing.

Malformed call:
${leakedCall.raw}`,
            },
          ],
          output: Output.object({ schema: tool.inputSchema }),
          experimental_telemetry: {
            isEnabled: true,
            functionId,
            metadata: {
              ...this.buildMetadata({ config, metadata, tags }),
              recoveredLeakedToolCall: leakedCall.name,
            },
          },
          providerOptions: this.buildProviderOptions({ config, callOrigin, metadata, tags }),
        })

        // The tool's own schema is the last gate before a side effect runs.
        const validatedInput = await asSchema(tool.inputSchema).validate?.(recoveredInput.output)
        const input = validatedInput?.success ? validatedInput.value : recoveredInput.output
        if (validatedInput && !validatedInput.success) {
          this.leakedToolCallLogger.error(
            `recovered arguments for "${leakedCall.name}" failed the tool schema — not executed`,
          )
          continue
        }

        await tool.execute(input, {
          toolCallId: `recovered-${leakedCall.name}`,
          messages: [],
        })
        this.leakedToolCallLogger.warn(
          `recovered the leaked call to "${leakedCall.name}" through structured output and executed it`,
        )
      }
    } catch (error) {
      this.leakedToolCallLogger.error(
        `leaked tool call recovery failed: ${error instanceof Error ? error.message : error}`,
      )
    }
  }

  protected async runEndOfTurnTools({
    model,
    config,
    callOrigin,
    metadata,
    functionId,
    messages,
    streamResult,
    tags,
  }: {
    model: LanguageModelV3
    config: LLMConfig
    callOrigin: CallOrigin
    metadata: LLMMetadata
    /**
     * MUST be the same functionId as the answering loop: the langfuse
     * exporter names the whole trace after the first resource.name it sees,
     * and langfuse.trace() upserts — a distinct functionId here renames the
     * user-facing trace to the bookkeeping call's name.
     */
    functionId: string
    messages: LLMChatMessage[]
    streamResult: {
      steps: PromiseLike<Array<{ toolResults: Array<{ toolName: string; output: unknown }> }>>
      response: PromiseLike<{ messages: LLMChatMessage[] }>
    }
    tags: string[]
  }): Promise<void> {
    const endOfTurnTools = config.endOfTurnTools
    if (!endOfTurnTools || Object.keys(endOfTurnTools).length === 0) return

    try {
      // Skip the tools the loop already EXECUTED — forcing them again would
      // run their side effects twice. Executions (toolResults), not calls:
      // a voluntary call with invalid arguments never executes and must not
      // suppress the forced retry. Executions flagged endOfTurnNoOp recorded
      // nothing (e.g. an empty {} report) and do not count either.
      // A tool can also invalidate an execution after the fact through
      // config.endOfTurnExecutionCounts (e.g. a turn summary submitted
      // BEFORE the knowledge base lookup cannot have cited sources).
      const executionCounts = config.endOfTurnExecutionCounts ?? (() => true)
      const steps = await streamResult.steps
      const executedToolNames = new Set(
        steps.flatMap((step) =>
          step.toolResults
            .filter(
              (toolResult) =>
                (toolResult.output as { endOfTurnNoOp?: boolean } | undefined)?.endOfTurnNoOp !==
                  true && executionCounts(toolResult),
            )
            .map((toolResult) => toolResult.toolName),
        ),
      )
      const missingEndOfTurnTools = Object.fromEntries(
        Object.entries(endOfTurnTools).filter(([toolName]) => !executedToolNames.has(toolName)),
      )
      if (Object.keys(missingEndOfTurnTools).length === 0) return

      const responseMessages = (await streamResult.response).messages
      const endOfTurnResult = await generateText({
        model,
        messages: [
          ...messages,
          ...responseMessages,
          // Some providers (Vertex gemini-3.5-flash-lite and newer) reject
          // requests ending with a model turn — close with an explicit user
          // instruction for the bookkeeping call. Phrased so its content
          // never leaks into the report (a session got titled "Demande de
          // résumé de tour" after an earlier wording of this message).
          {
            role: "user",
            content:
              "(bookkeeping, not a user message) Call the required tool now. Base its content ONLY on the conversation above — ignore this message entirely.",
          },
        ],
        temperature: config.temperature,
        tools: missingEndOfTurnTools,
        toolChoice: "required",
        experimental_telemetry: {
          isEnabled: true,
          functionId,
          // Distinguish the forced bookkeeping generation from the answering
          // loop in langfuse via metadata, not functionId (see above).
          metadata: { ...this.buildMetadata({ config, metadata, tags }), endOfTurnTools: true },
        },
        providerOptions: this.buildProviderOptions({ config, callOrigin, metadata, tags }),
      })
      // toolChoice "required" guarantees a call was EMITTED, not that it was
      // EXECUTED: invalid arguments or a provider quirk leave toolResults
      // empty and the report silently skipped — make that loud.
      if (endOfTurnResult.toolResults.length === 0) {
        this.endOfTurnLogger.error(
          `end-of-turn tools produced no executed result (calls: ${JSON.stringify(
            endOfTurnResult.toolCalls.map((toolCall) => toolCall.toolName),
          )}, finishReason: ${endOfTurnResult.finishReason})`,
        )
      }
    } catch (error) {
      this.endOfTurnLogger.error(
        `end-of-turn tools call failed: ${error instanceof Error ? error.message : error}`,
      )
    }
  }
  protected logLeakedToolCalls({
    originalText,
    config,
    leakedToolCalls,
  }: {
    originalText: string
    config?: LLMConfig
    leakedToolCalls?: LeakedToolCall[]
  }): void {
    try {
      const found = findLeakedToolCalls(originalText)
      if (found.length === 0) return
      const leakedToolNames = found.map((leakedCall) => leakedCall.name)
      leakedToolCalls?.push(...found)
      const declaredToolNames = [
        ...Object.keys(config?.tools ?? {}),
        ...Object.keys(config?.endOfTurnTools ?? {}),
      ]
      this.leakedToolCallLogger.error(
        `model verbalized tool call(s) in the text channel instead of calling them — NOT executed: ${JSON.stringify(
          leakedToolNames,
        )} (declared: ${JSON.stringify(declaredToolNames)}, model: ${config?.model})`,
      )
    } catch {
      // never let diagnostics break the generation
    }
  }
  /**
   * Providers whose backend enforces tool argument schemas when tools are
   * marked `strict` opt in here (Vertex Gemini: mode VALIDATED). Applied to
   * the answering loop only — never to the forced end-of-turn generation,
   * which needs mode ANY to actually force the call.
   */
  protected supportsStrictTools(): boolean {
    return false
  }
}
