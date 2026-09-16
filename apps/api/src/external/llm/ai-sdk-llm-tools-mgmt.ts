import type { LanguageModelV3 } from "@ai-sdk/provider"
import { Logger } from "@nestjs/common"
import { asSchema, generateText, Output } from "ai"
import type { LLMConfig, LLMMetadata } from "@/common/interfaces/llm-provider.interface"
import { AISDKLLMBuilders } from "@/external/llm/ai-sdk-llm-builders"
import type { CallOrigin } from "@/external/llm/ai-sdk-llm-common"
import { findLeakedToolCalls, type LeakedToolCall } from "@/external/llm/llm-output-sanitizer"

export abstract class AISDKLLMToolsMgmt extends AISDKLLMBuilders {
  /**
   * A model that VERBALIZES a tool call in the text channel instead of
   * emitting it (documented Gemini failure family) means the tool never
   * ran: the sanitizer hides the tag from the user, so without this log the
   * failure would be completely silent. Logged loudly so monitoring can
   * catch it — a tool with side effects must never fail unnoticed.
   */
  protected readonly leakedToolCallLogger = new Logger("LeakedToolCall")

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
      const declaredToolNames = Object.keys(config?.tools ?? {})
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
   * marked `strict` opt in here (Vertex Gemini: mode VALIDATED).
   */
  protected supportsStrictTools(): boolean {
    return false
  }
}
