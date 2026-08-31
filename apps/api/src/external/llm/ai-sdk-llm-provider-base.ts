import type {
  LanguageModelV3,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from "@ai-sdk/provider"
import { AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { Logger, NotImplementedException } from "@nestjs/common"
import { trace } from "@opentelemetry/api"
import {
  asSchema,
  type FilePart,
  generateText,
  type JSONSchema7,
  jsonSchema,
  Output,
  stepCountIs,
  ToolLoopAgent,
  wrapLanguageModel,
} from "ai"
import { type ZodObject, z } from "zod"
import type {
  LLMChatMessage,
  LLMConfig,
  LLMFile,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import { removeNullish } from "@/common/utils/remove-nullish"
import { fireAndForgetStopCondition } from "@/external/llm/fire-and-forget-stop-condition"
import {
  convertPdfPartsToImageParts,
  modelRequiresPdfAsImages,
} from "@/external/llm/pdf-to-image-parts"
import { ResponseHelper } from "@/external/llm/response-helper"
import { withStrictTools } from "@/external/llm/strict-tools"
import {
  findLeakedToolCalls,
  type LeakedToolCall,
  ThoughtTokensHelper,
} from "@/external/llm/thought-tokens-helper"

// OTel attribute keys under which we publish the raw LLM request body and
// response. The `ai.telemetry.metadata.` prefix is required so the AI SDK
// accepts the attribute and so LangfuseIntegrationExporter picks it up.
// The exporter recognises these specific keys and surfaces them together
// as a dedicated child span (named "llm.call") under each generation,
// with the request as input and the response as output, instead of
// burying them in the metadata blob.
export const RAW_LLM_REQUEST_ATTR = "ai.telemetry.metadata.rawLlmRequest"
export const RAW_LLM_RESPONSE_ATTR = "ai.telemetry.metadata.rawLlmResponse"
export const RAW_LLM_RESPONSE_STRIPPED_ATTR = "ai.telemetry.metadata.rawLlmResponseStripped"

function extractTextFromContent(content: unknown): string {
  if (!Array.isArray(content)) return ""
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("")
}

function describeStreamError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function extractTextFromStreamChunks(chunks: unknown[]): string {
  let text = ""
  for (const chunk of chunks) {
    if (
      typeof chunk === "object" &&
      chunk !== null &&
      (chunk as { type?: unknown }).type === "text-delta" &&
      typeof (chunk as { delta?: unknown }).delta === "string"
    ) {
      text += (chunk as { delta: string }).delta
    }
  }
  return text
}

export abstract class AISDKLLMProviderBase implements LLMProvider {
  private readonly endOfTurnLogger = new Logger("EndOfTurnTools")
  /**
   * A model that VERBALIZES a tool call in the text channel instead of
   * emitting it (documented Gemini failure family) means the tool never
   * ran: the sanitizer hides the tag from the user, so without this log the
   * failure would be completely silent. Logged loudly so monitoring can
   * catch it — a tool with side effects must never fail unnoticed.
   */
  private readonly leakedToolCallLogger = new Logger("LeakedToolCall")

  // PATCH_HEDGED_RETRY_V1_APPLIED
  /**
   * Self-hosted models (Gemma) occasionally stall before producing anything at all - e.g. the
   * idle-timeout in ai-sdk-gemma.provider.ts firing because no chunk ever arrived. Observed in
   * production: the very next call right after such a failure typically succeeds in under a
   * second, so one silent retry absorbs most of these before the user ever sees an error.
   */
  private readonly llmStreamRetryLogger = new Logger("LLMStreamRetry")

  /**
   * Delay (ms) after which a still-silent `doStream()` attempt gets a concurrent second attempt
   * racing it, instead of waiting for the first to fully fail (see `doStreamWithRetry`). Undefined
   * by default - only a provider known to occasionally stall before producing anything (Gemma)
   * overrides this. Doubling a call is a real cost/quota concern on a paid, per-token provider
   * that doesn't have this problem, so opting in per-provider keeps the others exactly as today.
   */
  protected getHedgeDelayMs(): number | undefined {
    return undefined
  }

  /**
   * Runs one `doStream()` attempt through to its first chunk. Resolves `{ ok: true, ... }` with
   * the reader positioned right after that first chunk (so the caller can replay it and keep
   * reading), or `{ ok: false, error }` if `doStream()` rejected, the read itself threw, or the
   * first chunk was an `error` part - the three ways an attempt can die before producing anything.
   */
  private async runStreamAttempt(doStream: () => PromiseLike<LanguageModelV3StreamResult>): Promise<
    | {
        ok: true
        result: LanguageModelV3StreamResult
        first: ReadableStreamReadResult<LanguageModelV3StreamPart>
        reader: ReadableStreamDefaultReader<LanguageModelV3StreamPart>
      }
    | { ok: false; error: unknown }
  > {
    let result: LanguageModelV3StreamResult
    try {
      result = await doStream()
    } catch (error) {
      return { ok: false, error }
    }

    const reader = result.stream.getReader()
    let first: ReadableStreamReadResult<LanguageModelV3StreamPart>
    try {
      first = await reader.read()
    } catch (error) {
      reader.releaseLock()
      return { ok: false, error }
    }
    if (!first.done && first.value.type === "error") {
      reader.releaseLock()
      return { ok: false, error: first.value.error }
    }

    return { ok: true, result, first, reader }
  }

  /**
   * Rebuilds a stream that replays the already-read first chunk, then continues reading from the
   * same reader - the counterpart to `runStreamAttempt`'s peek.
   */
  private buildStreamFromAttempt({
    result,
    first,
    reader,
  }: {
    result: LanguageModelV3StreamResult
    first: ReadableStreamReadResult<LanguageModelV3StreamPart>
    reader: ReadableStreamDefaultReader<LanguageModelV3StreamPart>
  }): LanguageModelV3StreamResult {
    return {
      ...result,
      stream: new ReadableStream<LanguageModelV3StreamPart>({
        async start(controller) {
          if (first.done) {
            controller.close()
            return
          }
          controller.enqueue(first.value)
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                controller.close()
                return
              }
              controller.enqueue(value)
            }
          } catch (error) {
            controller.error(error)
          }
        },
        cancel(reason) {
          reader.cancel(reason).catch(() => {})
        },
      }),
    }
  }

  private async retryOnceOrThrow(
    doStream: () => PromiseLike<LanguageModelV3StreamResult>,
    failedAttemptError: unknown,
  ): Promise<LanguageModelV3StreamResult> {
    this.llmStreamRetryLogger.warn(
      `Stream attempt failed before producing anything, retrying: ${describeStreamError(failedAttemptError)}`,
    )
    const second = await this.runStreamAttempt(doStream)
    if (second.ok) return this.buildStreamFromAttempt(second)
    throw second.error
  }

  /**
   * Retries `doStream()` once if it fails, or its stream errors, before a single chunk has been
   * read. Once even one chunk has been read, a stall is surfaced immediately instead of retried:
   * that chunk may already be on its way downstream (e.g. forwarded to the streaming response),
   * so retrying at that point would risk duplicating or interleaving content.
   *
   * With `hedgeDelayMs` set (Gemma only, via `getHedgeDelayMs`), a second attempt is fired
   * *concurrently* as soon as the first one has been silent for that long, instead of waiting for
   * it to fully fail first - the two race, and whichever produces a usable first chunk wins. This
   * cuts real-stall recovery time roughly from "one full timeout" down to "hedge delay + a fast
   * retry".
   */
  private async doStreamWithRetry(
    doStream: () => PromiseLike<LanguageModelV3StreamResult>,
    hedgeDelayMs?: number,
  ): Promise<LanguageModelV3StreamResult> {
    const attempt1 = this.runStreamAttempt(doStream)

    if (hedgeDelayMs === undefined) {
      const first = await attempt1
      if (first.ok) return this.buildStreamFromAttempt(first)
      return this.retryOnceOrThrow(doStream, first.error)
    }

    let hedgeTimer: ReturnType<typeof setTimeout> | undefined
    const hedgeSignal = new Promise<"hedge">((resolve) => {
      hedgeTimer = setTimeout(() => resolve("hedge"), hedgeDelayMs)
    })
    const first = await Promise.race([attempt1, hedgeSignal])
    clearTimeout(hedgeTimer)

    if (first !== "hedge") {
      if (first.ok) return this.buildStreamFromAttempt(first)
      return this.retryOnceOrThrow(doStream, first.error)
    }

    this.llmStreamRetryLogger.warn(
      `Stream attempt silent for ${hedgeDelayMs}ms, hedging with a concurrent second attempt`,
    )
    const attempt2 = this.runStreamAttempt(doStream)
    const winner = await Promise.race([
      attempt1.then((result) => ({ source: "attempt1" as const, result })),
      attempt2.then((result) => ({ source: "attempt2" as const, result })),
    ])

    if (winner.result.ok) {
      const loser = winner.source === "attempt1" ? attempt2 : attempt1
      loser.then((result) => {
        if (result.ok) result.reader.cancel()
      })
      return this.buildStreamFromAttempt(winner.result)
    }

    const other = await (winner.source === "attempt1" ? attempt2 : attempt1)
    if (other.ok) return this.buildStreamFromAttempt(other)
    throw other.error ?? winner.result.error
  }

  private logLeakedToolCalls({
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
  protected getLanguageModelWithRawCapture(args: {
    config: LLMConfig
    callOrigin: CallOrigin
    /**
     * Request-scoped sink for tool calls the model verbalized in the text
     * channel. The sanitizer removes the tag before anything downstream sees
     * it, so the raw leak has to be captured here, in the middleware.
     */
    leakedToolCalls?: LeakedToolCall[]
  }): LanguageModelV3 {
    const baseModel = this.getLanguageModel(args)
    // Bound for use inside the stream TransformStream, where `this` is the
    // transformer, not the provider.
    const logLeaked = ({ originalText }: { originalText: string }) =>
      this.logLeakedToolCalls({
        originalText,
        config: args.config,
        leakedToolCalls: args.leakedToolCalls,
      })
    return wrapLanguageModel({
      model: baseModel,
      middleware: {
        specificationVersion: "v3",
        wrapGenerate: async ({ doGenerate }) => {
          const result = await doGenerate()
          try {
            const activeSpan = trace.getActiveSpan()
            const req = result.request?.body
            if (req !== undefined) {
              activeSpan?.setAttribute(
                RAW_LLM_REQUEST_ATTR,
                typeof req === "string" ? req : JSON.stringify(req),
              )
            }
            const raw = result.response?.body ?? result.content
            const rawStr = typeof raw === "string" ? raw : JSON.stringify(raw)
            activeSpan?.setAttribute(RAW_LLM_RESPONSE_ATTR, rawStr)
            const originalText = extractTextFromContent(result.content)
            if (originalText !== "") {
              const strippedText = ThoughtTokensHelper.removeThoughtTokens(originalText)
              if (strippedText !== originalText) {
                activeSpan?.setAttribute(RAW_LLM_RESPONSE_STRIPPED_ATTR, strippedText)
              }
              this.logLeakedToolCalls({
                originalText,
                config: args.config,
                leakedToolCalls: args.leakedToolCalls,
              })
            }
          } catch {
            // never let telemetry capture break the generation
          }
          // Apply thought-token stripping to text parts so downstream code
          // (ai-sdk consumers, our wrapper methods) sees cleaned content.
          try {
            if (Array.isArray(result.content)) {
              // biome-ignore lint/suspicious/noExplicitAny: content shape varies by provider
              ;(result as any).content = result.content.map((part: unknown) => {
                if (
                  typeof part === "object" &&
                  part !== null &&
                  (part as { type?: unknown }).type === "text" &&
                  typeof (part as { text?: unknown }).text === "string"
                ) {
                  const original = (part as { text: string }).text
                  return { ...part, text: ThoughtTokensHelper.removeThoughtTokens(original) }
                }
                return part
              })
            }
          } catch {
            // never let token stripping break the generation
          }
          return result
        },
        wrapStream: async ({ doStream }) => {
          const { stream, ...rest } = await this.doStreamWithRetry(doStream, this.getHedgeDelayMs())
          try {
            const req = rest.request?.body
            if (req !== undefined) {
              trace
                .getActiveSpan()
                ?.setAttribute(
                  RAW_LLM_REQUEST_ATTR,
                  typeof req === "string" ? req : JSON.stringify(req),
                )
            }
          } catch {
            // never let telemetry capture break the stream
          }
          const rawChunks: unknown[] = []
          let stripper: ReturnType<typeof ThoughtTokensHelper.createStripper> | null = null
          let currentTextId: string | undefined
          const transformed = stream.pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                // biome-ignore lint/suspicious/noExplicitAny: stream chunk shape varies by provider
                const c = chunk as any
                rawChunks.push(chunk)
                if (c?.type === "text-start") {
                  stripper = ThoughtTokensHelper.createStripper()
                  currentTextId = typeof c.id === "string" ? c.id : undefined
                  controller.enqueue(chunk)
                } else if (
                  c?.type === "text-delta" &&
                  typeof c.delta === "string" &&
                  stripper !== null
                ) {
                  const cleaned = stripper.feed(c.delta)
                  if (cleaned) controller.enqueue({ ...c, delta: cleaned })
                } else if (c?.type === "text-end") {
                  if (stripper !== null) {
                    const tail = stripper.flush()
                    if (tail) {
                      controller.enqueue(
                        currentTextId !== undefined
                          ? { type: "text-delta", id: currentTextId, delta: tail }
                          : { type: "text-delta", delta: tail },
                      )
                    }
                    stripper = null
                    currentTextId = undefined
                  }
                  controller.enqueue(chunk)
                } else {
                  controller.enqueue(chunk)
                }
              },
              flush(controller) {
                if (stripper !== null) {
                  const tail = stripper.flush()
                  if (tail) {
                    controller.enqueue(
                      currentTextId !== undefined
                        ? { type: "text-delta", id: currentTextId, delta: tail }
                        : { type: "text-delta", delta: tail },
                    )
                  }
                  stripper = null
                  currentTextId = undefined
                }
                try {
                  const grouped = ResponseHelper.groupStreamChunksForReadability(rawChunks)
                  const groupedStr = JSON.stringify(grouped)
                  const activeSpan = trace.getActiveSpan()
                  activeSpan?.setAttribute(RAW_LLM_RESPONSE_ATTR, groupedStr)
                  const originalText = extractTextFromStreamChunks(rawChunks)
                  if (originalText !== "") {
                    const strippedText = ThoughtTokensHelper.removeThoughtTokens(originalText)
                    if (strippedText !== originalText) {
                      activeSpan?.setAttribute(RAW_LLM_RESPONSE_STRIPPED_ATTR, strippedText)
                    }
                    logLeaked({ originalText })
                  }
                } catch {
                  // never let telemetry capture break the stream
                }
              },
            }),
          )
          return { stream: transformed, ...rest }
        },
      },
    })
  }

  async *streamChatResponse({
    messages,
    config,
    metadata,
  }: {
    messages: LLMChatMessage[]
    config: LLMConfig
    metadata: LLMMetadata
  }): AsyncGenerator<string, void, unknown> {
    const callOrigin = config.tools
      ? CallOrigin.streamChatResponse_withTools
      : CallOrigin.streamChatResponse
    this.checkConfigProviderAndModel(config)
    // Gemma and MedGemma only accept images: send pdfs as one image per page
    if (modelRequiresPdfAsImages(config.model)) {
      messages = await Promise.all(messages.map(convertPdfPartsToImageParts))
    }
    const aiSDKMessages: LLMChatMessage[] = messages
      .map((message) => {
        if (message.role === "system") {
          return undefined
        }
        return {
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        }
      })
      .filter((msg) => msg !== undefined) as LLMChatMessage[]

    if (aiSDKMessages.length === 0) {
      throw new Error("Cannot stream response: no valid messages provided")
    }

    const systemMessage = messages.find((msg) => msg.role === "system")?.content
    const functionId = this.buildFunctionIdForStreamChatResponse(aiSDKMessages)

    // Request-scoped: tool calls the model verbalized in the text channel
    // instead of emitting them. Collected by the raw-capture middleware and
    // recovered after the stream (see recoverLeakedToolCalls).
    const leakedToolCalls: LeakedToolCall[] = []

    const agent = new ToolLoopAgent({
      model: this.getLanguageModelWithRawCapture({ config, callOrigin, leakedToolCalls }),
      temperature: config.temperature,
      tools: this.supportsStrictTools() ? withStrictTools(config.tools) : config.tools,
      // Keep the default step safety net, but skip the follow-up generation
      // when a step only ran fire-and-forget tools (their output is noise).
      ...(config.fireAndForgetToolNames?.length
        ? {
            stopWhen: [
              stepCountIs(20),
              fireAndForgetStopCondition({
                fireAndForgetToolNames: config.fireAndForgetToolNames,
              }),
            ],
          }
        : {}),
      experimental_telemetry: {
        isEnabled: true,
        functionId,
        metadata: this.buildMetadata({ config, metadata }),
      },
      providerOptions: {
        custom: this.buildCustomProviderOptions({ config, callOrigin, metadata }),
      },
    })

    let systemPrompt = systemMessage || config.systemPrompt || ""
    systemPrompt = this.applySpecificToSystemPrompt({ systemPrompt, config, callOrigin })
    const systemMessagePart = systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }]
      : []

    const fullMessages = [...systemMessagePart, ...aiSDKMessages]
    const streamResult = await agent.stream({ messages: fullMessages })

    // The AI SDK never throws stream failures at the consumer: they surface
    // as `error` parts on fullStream, which textStream filters out — the
    // stream just ends, indistinguishable from an empty answer. Consume
    // fullStream so a failed generation rejects and callers can report it.
    for await (const part of streamResult.fullStream) {
      if (part.type === "text-delta") yield part.text
      else if (part.type === "error") throw part.error
    }

    await this.runEndOfTurnTools({
      config,
      callOrigin,
      metadata,
      functionId,
      messages: fullMessages,
      streamResult,
    })

    await this.recoverLeakedToolCalls({
      config,
      callOrigin,
      metadata,
      functionId,
      leakedToolCalls,
      streamResult,
    })
  }

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
  private async recoverLeakedToolCalls({
    config,
    callOrigin,
    metadata,
    functionId,
    leakedToolCalls,
    streamResult,
  }: {
    config: LLMConfig
    callOrigin: CallOrigin
    metadata: LLMMetadata
    functionId: string
    leakedToolCalls: LeakedToolCall[]
    streamResult: {
      steps: PromiseLike<Array<{ toolResults: Array<{ toolName: string; output: unknown }> }>>
    }
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
          model: this.getLanguageModelWithRawCapture({ config, callOrigin }),
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
              ...this.buildMetadata({ config, metadata }),
              recoveredLeakedToolCall: leakedCall.name,
            },
          },
          providerOptions: {
            custom: this.buildCustomProviderOptions({ config, callOrigin, metadata }),
          },
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

  private async runEndOfTurnTools({
    config,
    callOrigin,
    metadata,
    functionId,
    messages,
    streamResult,
  }: {
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
        model: this.getLanguageModelWithRawCapture({ config, callOrigin }),
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
          metadata: { ...this.buildMetadata({ config, metadata }), endOfTurnTools: true },
        },
        providerOptions: {
          custom: this.buildCustomProviderOptions({ config, callOrigin, metadata }),
        },
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
  async generateChatResponse({
    message,
    config,
    metadata,
  }: {
    message: LLMChatMessage
    config: LLMConfig
    metadata: LLMMetadata
  }): Promise<string> {
    const callOrigin = CallOrigin.generateChatResponse
    this.checkConfigProviderAndModel(config)
    const aiSDKMessages: LLMChatMessage[] = [message]
      .map((message) => {
        if (message.role === "system") {
          return undefined
        }
        return {
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        }
      })
      .filter((msg) => msg !== undefined) as LLMChatMessage[]

    if (aiSDKMessages.length === 0) {
      throw new Error("Cannot stream response: no valid messages provided")
    }

    const result = await generateText({
      model: this.getLanguageModelWithRawCapture({ config, callOrigin }),
      messages: aiSDKMessages,
      system: config.systemPrompt,
      temperature: config.temperature,
      experimental_telemetry: {
        isEnabled: true,
        functionId: this.buildFunctionIdForStreamChatResponse(aiSDKMessages),
        metadata: this.buildMetadata({ config, metadata }),
      },
      providerOptions: {
        custom: this.buildCustomProviderOptions({ config, callOrigin, metadata }),
      },
    })
    return result.text
  }
  async generateText({
    prompt,
    config,
    metadata,
  }: {
    prompt: string
    config: LLMConfig
    metadata: LLMMetadata
  }): Promise<string> {
    const callOrigin = CallOrigin.generateText
    this.checkConfigProviderAndModel(config)
    const { text } = await generateText({
      model: this.getLanguageModelWithRawCapture({ config, callOrigin }),
      system: config.systemPrompt,
      prompt,
      temperature: config.temperature,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "LLMProvider.generateText",
        metadata: this.buildMetadata({ config, metadata }),
      },
      providerOptions: {
        custom: this.buildCustomProviderOptions({ config, callOrigin, metadata }),
      },
    })
    return text
  }

  // biome-ignore lint/suspicious/noExplicitAny: @did : une idée
  async generateObject<T extends ZodObject<any>>({
    schema,
    prompt,

    config,
    metadata,
  }: {
    schema: T
    prompt: string
    config: LLMConfig
    metadata: LLMMetadata
  }): Promise<z.infer<T>> {
    const callOrigin = CallOrigin.generateObject
    this.checkConfigProviderAndModel(config)
    const res = await generateText({
      model: this.getLanguageModelWithRawCapture({ config, callOrigin }),
      system: config.systemPrompt,
      prompt,
      temperature: config.temperature,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "LLMProvider.generateObject",
        metadata: this.buildMetadata({
          config,
          metadata,
          schema: schema.toJSONSchema() as JSONSchema7,
        }),
      },
      output: Output.object({
        schema: schema,
      }),
      providerOptions: {
        custom: this.buildCustomProviderOptions({
          config,
          callOrigin,
          metadata,
          schema: schema.toJSONSchema() as JSONSchema7,
        }),
      },
    })
    return schema.parse(res.output)
  }

  async generateStructuredOutput({
    message,
    schema,
    config,
    metadata,
  }: {
    message: LLMChatMessage
    schema: Record<string, unknown>
    config: LLMConfig
    metadata: LLMMetadata
  }): Promise<Record<string, unknown>> {
    const callOrigin = CallOrigin.generateStructuredOutput
    this.checkConfigProviderAndModel(config)
    if (AgentModelToAgentProvider[config.model] === AgentProvider._Mock) {
      const fakeFile: LLMFile = {
        type: "file",
        name: "file1.pdf",
        mediaType: "application/pdf",
        content: Buffer.from("%PDF-1.4\n%%EOF"),
      }
      message = {
        role: "user",
        content: [
          { type: "text", text: "prompt" },
          {
            type: fakeFile.type as "file",
            mediaType: fakeFile.mediaType,
            data: fakeFile.content,
            filename: fakeFile.name,
          },
        ],
      }
    }
    // Gemma and MedGemma only accept images: send pdfs as one image per page
    if (modelRequiresPdfAsImages(config.model)) {
      message = await convertPdfPartsToImageParts(message)
    }
    //Mistral restriction: no pdf
    if (AgentModelToAgentProvider[config.model] === AgentProvider.Mistral) {
      if (Array.isArray(message.content)) {
        const filePart = message.content.find((p): p is FilePart => p.type === "file")
        if (filePart?.mediaType === "application/pdf") {
          throw new Error(`Model cannot process ${filePart?.mediaType} file`)
        }
      }
    }

    const aiSDKMessages: LLMChatMessage[] = [message]
      .map((currentMessage) => {
        if (currentMessage.role === "system") {
          return undefined
        }
        return {
          role: currentMessage.role === "assistant" ? "assistant" : "user",
          content: currentMessage.content,
        }
      })
      .filter((currentMessage) => currentMessage !== undefined) as LLMChatMessage[]

    if (aiSDKMessages.length === 0) {
      throw new Error("Cannot generate structured output: no valid messages provided")
    }

    const result = await generateText({
      model: this.getLanguageModelWithRawCapture({ config, callOrigin }),
      messages: aiSDKMessages,
      system: config.systemPrompt,
      temperature: config.temperature,
      output: Output.object({
        schema: jsonSchema<Record<string, unknown>>(schema),
      }),
      experimental_telemetry: {
        isEnabled: true,
        functionId: "LLMProvider.generateStructuredOutput",
        metadata: this.buildMetadata({
          config,
          metadata,
          schema,
        }),
      },
      providerOptions: {
        custom: this.buildCustomProviderOptions({
          config,
          callOrigin,
          metadata,
          schema,
        }),
      },
    })
    if (
      AgentModelToAgentProvider[config.model] === AgentProvider.MedGemma ||
      AgentModelToAgentProvider[config.model] === AgentProvider.Gemma
    ) {
      // @ts-expect-error
      return JSON.parse(result?.steps[0]?.content[0]?.text)
    }
    return result.output
  }
  // biome-ignore lint/suspicious/noExplicitAny: Zod def
  private recordToZodSchema(record: Record<string, unknown>): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {}

    for (const [key, value] of Object.entries(record)) {
      shape[key] = this.inferZodType(value)
    }

    return z.object(shape)
  }

  private inferZodType(value: unknown): z.ZodTypeAny {
    if (typeof value === "string") return z.string()
    if (typeof value === "number") return z.number()
    if (typeof value === "boolean") return z.boolean()
    if (value === null) return z.null()

    if (Array.isArray(value)) {
      if (value.length === 0) return z.array(z.any())
      return z.array(this.inferZodType(value[0]))
    }

    if (typeof value === "object") {
      return this.recordToZodSchema(value as Record<string, unknown>)
    }

    return z.any()
  }

  private checkConfigProviderAndModel(config: LLMConfig): void {
    const provider = AgentModelToAgentProvider[config.model]
    if (provider !== this.getAgentProvider())
      throw new NotImplementedException(
        `DEV - missing or invalid association between agent provider (${provider}) and agent model (${config.model})`,
      )
  }

  private buildFunctionIdForStreamChatResponse(aiSDKMessages: LLMChatMessage[]): string {
    return `LLMProvider.streamChatResponse [${aiSDKMessages.filter((m) => m.role === "assistant").length + 1} turn(s)]` //+1 => current turn
  }

  private buildMetadata({
    config,
    metadata,
    schema,
  }: {
    config: LLMConfig
    metadata: LLMMetadata
    schema?: JSONSchema7
  }): Record<string, string | number | string[]> {
    return removeNullish({
      langfuseTraceId: metadata.traceId,
      sessionId: `as:${metadata.langfuseSessionId ?? metadata.agentSessionId}`,
      userId: `o:${metadata.organizationId} / p:${metadata.projectId}`,
      tags: [...(metadata?.tags || []), ...this.getTags(config)],
      currentTurn: metadata.currentTurn,
      revision: metadata.revision,
      outputSchema: JSON.stringify(schema),
      availableTools: JSON.stringify(config.tools),
    })
  }

  private buildCustomProviderOptions({
    config,
    callOrigin,
    metadata,
    schema,
  }: {
    config: LLMConfig
    callOrigin: CallOrigin
    metadata: LLMMetadata
    schema?: JSONSchema7
  }) {
    return {
      callOrigin,
      agentId: metadata.agentId,
      metadata: this.buildMetadata({ config, metadata, schema }),
    }
  }

  abstract getLanguageModel({ config, callOrigin }: { config: LLMConfig; callOrigin: CallOrigin })
  abstract getTags(config: LLMConfig): string[]
  abstract getAgentProvider(): AgentProvider

  /**
   * Providers whose backend enforces tool argument schemas when tools are
   * marked `strict` opt in here (Vertex Gemini: mode VALIDATED). Applied to
   * the answering loop only — never to the forced end-of-turn generation,
   * which needs mode ANY to actually force the call.
   */
  protected supportsStrictTools(): boolean {
    return false
  }

  applySpecificToSystemPrompt({
    // biome-ignore lint/correctness/noUnusedFunctionParameters: used in override
    config,
    systemPrompt,
    // biome-ignore lint/correctness/noUnusedFunctionParameters: used in override
    callOrigin,
  }: {
    config: LLMConfig
    systemPrompt: string
    callOrigin: CallOrigin
  }): string {
    return systemPrompt
  }
}

export enum CallOrigin {
  streamChatResponse = "streamChatResponse",
  streamChatResponse_withTools = "streamChatResponse_withTools",
  generateChatResponse = "generateChatResponse",
  generateText = "generateText",
  generateObject = "generateObject",
  generateStructuredOutput = "generateStructuredOutput",
}
