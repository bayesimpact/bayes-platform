import type { LanguageModelV3 } from "@ai-sdk/provider"
import {
  type AgentModel,
  type AgentModelDeprecation,
  type AgentModelOf,
  AgentModelToAgentProvider,
  type AgentProvider,
} from "@caseai-connect/api-contracts"
import { Logger, NotImplementedException } from "@nestjs/common"
import { trace } from "@opentelemetry/api"
import { wrapLanguageModel } from "ai"
import type { ZodType, z } from "zod"
import type {
  LLMChatMessage,
  LLMConfig,
  LLMMetadata,
} from "@/common/interfaces/llm-provider.interface"
import type { SpecificProviderOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-builders"
import {
  type CallOrigin,
  extractTextFromContent,
  extractTextFromStreamChunks,
  RAW_LLM_REQUEST_ATTR,
  RAW_LLM_RESPONSE_ATTR,
  RAW_LLM_RESPONSE_STRIPPED_ATTR,
} from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import {
  AISDKLLMToolsMgmt,
  type LeakedToolCall,
  PSEUDO_TOOL_CALL_MAX_LEN,
  PSEUDO_TOOL_CALL_OPEN_RE,
  PSEUDO_TOOL_CALL_RE,
} from "@/external/llm/ai-sdk/ai-sdk-llm-tools-mgmt"

const logger = new Logger("AISDKLLMModelMgmt")

// Channel-name keywords that Gemma 4 / GPT-OSS-style models emit as the name
// inside `<|channel>name<channel|>` openers. When such a name appears as a
// bare standalone line (between two marker pairs, after the opener has been
// stripped), we treat it as leaked-marker content and drop it too.
const CHANNEL_KEYWORDS = "thought|analysis|reasoning|finalize|commentary|final"

/**
 * What the catalog says of a model. Every field is optional, but each provider declares an
 * entry for every model it serves: a new model cannot ship without one.
 */
export type ModelMetadata = {
  /** Set when the provider retires the model, with the model to move to. */
  deprecation?: AgentModelDeprecation
  /**
   * `true` when the provider does not serve the model from the EU region: it can only run
   * through a global endpoint, which carries no EU data-processing guarantee. Absent means
   * EU-served. Drives both the endpoint routing and the UI label.
   */
  servedOutsideEu?: boolean
}

/**
 * What a model accepts on top of the standard call settings: the schema of its
 * {@link SpecificProviderOptions} and their default values, which the agent
 * config then overrides (temperature, service tier, thinking level).
 */
export type ModelOptions = {
  schema: ZodType<SpecificProviderOptions>
  values: SpecificProviderOptions
}

/** Pairs a model's options schema with its values, which must conform to it at compile time. */
export function defineModelOptions<Schema extends ZodType<SpecificProviderOptions>>(
  schema: Schema,
  values: z.infer<Schema>,
): ModelOptions {
  return { schema, values }
}

/** `override` merged over `base`, object by object; any other value of `override` wins. */
function mergeModelOptions(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const baseValue = merged[key]
    merged[key] =
      isPlainObject(baseValue) && isPlainObject(value) ? mergeModelOptions(baseValue, value) : value
  }
  return merged
}

export type StreamPartLike =
  | { type: "start-step" }
  | { type: "finish-step" }
  | { type: "text-delta"; text: string }
  | { type: string }

export type StreamSanitizer = {
  /** Cleaned text that is safe to emit for this chunk (may be empty while holding back). */
  feed(chunk: string): string
  /** Cleaned text still held at the end of the stream. */
  flush(): string
}

/**
 * Drops a text block a model repeats after a tool result.
 *
 * Observed with Gemma: the model writes its message and calls a tool in the
 * same step (a hand-over, a conclusion, a form write), then, once the tool
 * result comes back, writes the very same message again in the next step.
 * Both steps stream to the user and are stored as one reply, so the user
 * reads it twice, word for word.
 *
 * Text of a step is held back while it matches the beginning of the previous
 * step's text; it is released as soon as it diverges, and dropped when the
 * step ends while still matching (an identical repeat, or a truncated one).
 * Only an exact repeat is dropped: a step that starts like the previous one
 * and then says something new is streamed whole, a little later.
 */
export type RepeatedStepTextFilter = {
  /** Text to emit for this part (nothing for non-text parts, or while holding). */
  feed(part: StreamPartLike): string
  /** Text still held at the end of the stream (empty when it was a repeat). */
  flush(): string
  /** The repeated blocks dropped so far, for logging. */
  dropped(): string[]
}

/**
 * Everything about the model a provider calls: which model and options it
 * serves, the middleware that captures the raw exchange, and the cleaning of
 * the text the model writes.
 */
export abstract class AISDKLLMModelMgmt<
  Provider extends AgentProvider = AgentProvider,
> extends AISDKLLMToolsMgmt {
  protected checkConfigProviderAndModel(config: LLMConfig): void {
    const provider = AgentModelToAgentProvider[config.model]
    if (provider !== this.getAgentProvider())
      throw new NotImplementedException(
        `DEV - missing or invalid association between agent provider (${provider}) and agent model (${config.model})`,
      )
  }

  /**
   * The model for one call. It is built per call, knowing the call: a model
   * that needs to know which call it serves (the mock's scripted answers, by
   * agent) reads it here rather than from the provider options.
   */
  abstract getLanguageModel(args: {
    config: LLMConfig
    callOrigin: CallOrigin
    metadata: LLMMetadata
  })
  abstract getTags(config: LLMConfig): string[]
  abstract getAgentProvider(): Provider

  protected abstract readonly modelOptions: Record<AgentModelOf<Provider>, ModelOptions>
  /** What the catalog says of each model the provider serves (retirement, data residency). */
  protected abstract readonly modelMetadata: Record<AgentModelOf<Provider>, ModelMetadata>

  getModelMetadata(agentModel: AgentModel): ModelMetadata {
    return this.modelMetadata[this.toProviderAgentModel(agentModel)]
  }

  getModelOptionsSchema(agentModel: AgentModel): ZodType<SpecificProviderOptions> {
    return this.modelOptions[this.toProviderAgentModel(agentModel)].schema
  }
  getModelOptions(agentModel: AgentModel): SpecificProviderOptions {
    return this.modelOptions[this.toProviderAgentModel(agentModel)].values
  }

  /**
   * The model's default options, with the ones of the call (the agent's
   * stored options, or an internal call's) merged over them and the call
   * settings applied, checked against the model's schema on every call. An
   * option the model does not take (a temperature it deprecated) is dropped.
   * Options that do not fit the schema (stored for another model) fall back
   * to the model's defaults.
   */
  protected buildSpecificProviderOptions({
    config,
  }: {
    config: LLMConfig
  }): SpecificProviderOptions {
    const { schema, values } = this.modelOptions[this.toProviderAgentModel(config.model)]
    const merged = schema.safeParse(
      this.applyConfigToModelOptions({
        config,
        values: mergeModelOptions(values, config.modelOptions ?? {}) as SpecificProviderOptions,
      }),
    )
    if (merged.success) return merged.data
    logger.warn("Model options that do not fit the model, falling back to its defaults", {
      model: config.model,
      modelOptions: config.modelOptions,
      issues: merged.error.issues,
    })
    return schema.parse(this.applyConfigToModelOptions({ config, values }))
  }

  /**
   * Applies the settings of the call that are not model options (the service
   * tier, the thinking level). None by default: a provider that has some
   * overrides this.
   */
  protected applyConfigToModelOptions({
    values,
  }: {
    config: LLMConfig
    values: SpecificProviderOptions
  }): SpecificProviderOptions {
    return values
  }

  // Composite removals that need a full self-contained match. Safe to run on a
  // partial streaming buffer because they only fire once both ends are present.
  protected stripPairedChannelMarkers(text: string): string {
    return (
      text
        // Hallucinated tool-call tags verbalized into the text
        .replace(PSEUDO_TOOL_CALL_RE, "")
        // The wrapper a model puts around such a call (`<code>…</code>`, a
        // fenced block) is left empty by the removal above: drop it too.
        .replace(/<code>\s*<\/code>/gi, "")
        .replace(/```[a-z]*\s*```/gi, "")
        // <|channel>thought<channel|> ... <channel|> (eats nested openers too)
        .replace(new RegExp(`<\\|channel>(?:${CHANNEL_KEYWORDS})[\\s\\S]*?<channel\\|>`, "gi"), "")
        // Gemma 3 legacy: <unused N>thought ... <unused N>
        .replace(/<unused\d+>thought[\s\S]*?(?=<unused\d+>)/gi, "")
        // Bare keyword lines left behind between paired markers
        // (e.g. "thought\n" sitting between two stripped `<|channel>...<channel|>`).
        .replace(new RegExp(`^(?:${CHANNEL_KEYWORDS})\\s*\\n`, "gim"), "")
    )
  }

  // Single-token removals. DANGEROUS to run on a partial streaming buffer
  // because they would consume one half of a marker that is still being
  // streamed. Apply only to text we are committing to emit / at flush time.
  protected stripStrayChannelTokens(text: string): string {
    return text
      .replace(/<\|"\|>/g, "")
      .replace(/<\|[a-z0-9_-]*>/gi, "")
      .replace(/<[a-z0-9_-]*\|>/gi, "")
      .replace(/<unused\d+>/g, "")
  }

  /**
   * One-shot removal of everything a model leaks into its user-visible text
   * that is not content: thought tokens (`<|channel>...<channel|>`,
   * `<unusedN>thought ...`, `<|...>`, `<...|>`, `<unusedN>`) and tool calls
   * verbalized in the text channel (see `PSEUDO_TOOL_CALL_RE`). For streaming, see
   * `createStreamSanitizer()`.
   */
  protected sanitize(text: string): string {
    return this.stripStrayChannelTokens(this.stripPairedChannelMarkers(text))
  }

  /**
   * Streaming-safe sanitizer. A marker like `<|channel>thought<channel|>` can
   * be split across multiple stream deltas, so we cannot regex each delta in
   * isolation. This holds back a small tail of the most recent text until we
   * are confident no marker is still mid-emission, then emits the cleaned
   * prefix. Call `flush()` at end of stream.
   */
  protected createStreamSanitizer(): StreamSanitizer {
    let pending = ""
    // How many trailing characters to hold back from emission. Must be longer
    // than the longest marker we might want to recognise once its closer
    // arrives, so an in-progress marker is never split across two emits.
    const HOLD_TAIL = 64
    // Upper bound on the length of any single marker. When the planned cut
    // point falls within this many characters of an earlier `<`, we MUST pull
    // the cut back to that `<`: otherwise we would emit a partial marker.
    const MAX_MARKER_LEN = 32

    return {
      // Arrow functions, so `this` stays the provider.
      feed: (chunk: string): string => {
        pending += chunk
        // Strip any FULLY PAIRED markers from the buffer. Safe mid-stream:
        // paired regexes only fire once both ends are present.
        pending = this.stripPairedChannelMarkers(pending)

        let safeUntil = pending.length - HOLD_TAIL
        if (safeUntil <= 0) return ""
        // A pseudo tool-call tag can be far longer than MAX_MARKER_LEN: if
        // one is still open in the buffer, hold everything back from its
        // `<` (bounded — a never-closing lookalike must not stall the stream).
        const pseudoOpen = pending.search(PSEUDO_TOOL_CALL_OPEN_RE)
        if (pseudoOpen !== -1 && pending.length - pseudoOpen < PSEUDO_TOOL_CALL_MAX_LEN) {
          safeUntil = Math.min(safeUntil, pseudoOpen)
        }
        const ltBeforeCut = Math.max(
          pending.lastIndexOf("<", safeUntil - 1),
          pending.lastIndexOf("[", safeUntil - 1),
        )
        if (ltBeforeCut !== -1 && safeUntil - ltBeforeCut < MAX_MARKER_LEN) {
          safeUntil = ltBeforeCut
        }
        if (safeUntil <= 0) return ""

        const emit = this.stripStrayChannelTokens(pending.slice(0, safeUntil))
        pending = pending.slice(safeUntil)
        return emit
      },
      flush: (): string => {
        const tail = this.stripStrayChannelTokens(this.stripPairedChannelMarkers(pending))
        pending = ""
        return tail
      },
    }
  }

  /**
   * The raw stream chunks of a call, with each run of text, tool-input and
   * reasoning deltas collapsed into one chunk, so the raw response recorded on
   * the trace reads as a few blocks instead of hundreds of deltas.
   */
  protected groupStreamChunksForReadability(chunks: unknown[]): unknown[] {
    const grouped: unknown[] = []
    type DeltaKind = "text" | "tool-input" | "reasoning"
    type Buffer = {
      kind: DeltaKind
      id?: string
      text: string
      // biome-ignore lint/suspicious/noExplicitAny: passthrough metadata varies
      extra?: Record<string, any>
    }
    let buffer: Buffer | null = null

    const startedField: Record<DeltaKind, string> = {
      text: "text",
      "tool-input": "input",
      reasoning: "text",
    }

    const flushBuffer = () => {
      if (buffer !== null) {
        grouped.push({
          type: `${buffer.kind}-stream-collapsed`,
          ...(buffer.id !== undefined ? { id: buffer.id } : {}),
          ...buffer.extra,
          [startedField[buffer.kind]]: buffer.text,
        })
        buffer = null
      }
    }

    const startBuffer = (kind: DeltaKind, c: Record<string, unknown>) => {
      flushBuffer()
      const { type: _ignored, id, delta: _ignored2, ...extra } = c
      buffer = { kind, id: typeof id === "string" ? id : undefined, text: "", extra }
    }

    const appendDelta = (kind: DeltaKind, c: Record<string, unknown>) => {
      if (buffer === null || buffer.kind !== kind) {
        startBuffer(kind, c)
      }
      if (buffer !== null && typeof c.delta === "string") {
        buffer.text += c.delta
      }
    }

    for (const chunk of chunks) {
      // biome-ignore lint/suspicious/noExplicitAny: stream chunk shape varies by provider
      const c = chunk as any
      switch (c?.type) {
        case "text-start":
          startBuffer("text", c)
          break
        case "text-delta":
          appendDelta("text", c)
          break
        case "text-end":
          flushBuffer()
          break
        case "tool-input-start":
          startBuffer("tool-input", c)
          break
        case "tool-input-delta":
          appendDelta("tool-input", c)
          break
        case "tool-input-end":
          flushBuffer()
          break
        case "reasoning-start":
          startBuffer("reasoning", c)
          break
        case "reasoning-delta":
          appendDelta("reasoning", c)
          break
        case "reasoning-end":
          flushBuffer()
          break
        default:
          flushBuffer()
          grouped.push(chunk)
      }
    }
    flushBuffer()
    return grouped
  }

  /** See {@link RepeatedStepTextFilter}. One filter per stream. */
  protected createRepeatedStepTextFilter(): RepeatedStepTextFilter {
    let previousStepText = ""
    let currentStepText = ""
    let held = ""
    let holding = false
    const droppedBlocks: string[] = []

    const endStep = (): string => {
      let emitted = ""
      if (holding && held.length > 0) {
        if (previousStepText.startsWith(held)) droppedBlocks.push(held)
        else emitted = held
      }
      if (currentStepText.length > 0) previousStepText = currentStepText
      currentStepText = ""
      held = ""
      holding = false
      return emitted
    }

    return {
      feed(part) {
        switch (part.type) {
          case "start-step":
            currentStepText = ""
            held = ""
            holding = previousStepText.length > 0
            return ""
          case "finish-step":
            return endStep()
          case "text-delta": {
            const text = (part as { text: string }).text
            currentStepText += text
            if (!holding) return text
            held += text
            if (previousStepText.startsWith(held)) return ""
            holding = false
            const release = held
            held = ""
            return release
          }
          default:
            return ""
        }
      },
      flush() {
        return endStep()
      },
      dropped() {
        return [...droppedBlocks]
      },
    }
  }

  /**
   * Narrows a model to the ones this provider serves, so it can index a
   * `Record<AgentModelOf<Provider>, ...>`. A model of another provider, or no
   * model at all (a config carries a plain string), throws.
   */
  protected toProviderAgentModel(agentModel: string): AgentModelOf<Provider> {
    if (AgentModelToAgentProvider[agentModel as AgentModel] !== this.getAgentProvider())
      throw new NotImplementedException(
        `DEV - model ${agentModel} is not served by provider ${this.getAgentProvider()}`,
      )
    return agentModel as AgentModelOf<Provider>
  }

  protected getLanguageModelWithRawCapture(args: {
    config: LLMConfig
    callOrigin: CallOrigin
    metadata: LLMMetadata
    /**
     * Request-scoped sink for tool calls the model verbalized in the text
     * channel. The sanitizer removes the tag before anything downstream sees
     * it, so the raw leak has to be captured here, in the middleware.
     */
    leakedToolCalls?: LeakedToolCall[]
  }): LanguageModelV3 {
    const baseModel = this.getLanguageModel(args)
    // Logs the tool calls the model verbalized in its text, for generate and
    // stream alike (the stream calls it from a plain method, where `this` is
    // not the provider).
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
              const strippedText = this.sanitize(originalText)
              if (strippedText !== originalText) {
                activeSpan?.setAttribute(RAW_LLM_RESPONSE_STRIPPED_ATTR, strippedText)
              }
              logLeaked({ originalText })
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
                  return { ...part, text: this.sanitize(original) }
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
          const { stream, ...rest } = await doStream()
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
          let stripper: StreamSanitizer | null = null
          // `transform` and `flush` below are plain methods: `this` is not the provider there.
          const createStreamSanitizer = () => this.createStreamSanitizer()
          const sanitize = (text: string) => this.sanitize(text)
          const groupStreamChunksForReadability = (chunks: unknown[]) =>
            this.groupStreamChunksForReadability(chunks)
          let currentTextId: string | undefined
          // A tool call whose arguments never parsed as JSON is dropped by the
          // OpenAI chat provider: the tracker emits it so the SDK can repair
          // it or report it to the model.
          const unfinishedToolCalls = this.createUnfinishedToolCallTracker()
          const transformed = stream.pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                // biome-ignore lint/suspicious/noExplicitAny: stream chunk shape varies by provider
                const c = chunk as any
                rawChunks.push(chunk)
                for (const part of unfinishedToolCalls.before(chunk)) controller.enqueue(part)
                if (c?.type === "text-start") {
                  stripper = createStreamSanitizer()
                  currentTextId = typeof c.id === "string" ? c.id : undefined
                  controller.enqueue(chunk)
                } else if (c?.type === "text-delta" && typeof c.delta === "string") {
                  // A delta that arrives without its text-start is cleaned too.
                  if (stripper === null) {
                    stripper = createStreamSanitizer()
                    currentTextId = typeof c.id === "string" ? c.id : undefined
                  }
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
                  const grouped = groupStreamChunksForReadability(rawChunks)
                  const groupedStr = JSON.stringify(grouped)
                  const activeSpan = trace.getActiveSpan()
                  activeSpan?.setAttribute(RAW_LLM_RESPONSE_ATTR, groupedStr)
                  const emittedToolCalls = unfinishedToolCalls.emitted()
                  if (emittedToolCalls.length > 0) {
                    activeSpan?.setAttribute(
                      "llm.tool_call.emitted_from_unfinished_input",
                      emittedToolCalls.join(","),
                    )
                    logger.warn("Emitted tool calls the provider dropped for malformed arguments", {
                      model: args.config.model,
                      toolNames: emittedToolCalls,
                    })
                  }
                  const originalText = extractTextFromStreamChunks(rawChunks)
                  if (originalText !== "") {
                    const strippedText = sanitize(originalText)
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

  protected applySpecificToSystemPrompt({
    systemPrompt,
  }: {
    config: LLMConfig
    systemPrompt: string
    callOrigin: CallOrigin
  }): string {
    return systemPrompt
  }

  /**
   * Adapts the message of a structured output call to what the provider
   * accepts, or throws when it cannot take it (a file type it does not read).
   */
  protected applySpecificToStructuredOutputMessage({
    message,
  }: {
    message: LLMChatMessage
    config: LLMConfig
  }): LLMChatMessage {
    return message
  }

  /**
   * Reads the object of a structured output call. By default it is the output
   * the AI SDK parsed against the schema; a provider whose model does not
   * honour the response format reads the text instead
   * (see {@link parseStructuredOutputText}).
   */
  protected readStructuredOutput(result: {
    text: string
    output: Record<string, unknown>
  }): Record<string, unknown> {
    return result.output
  }

  /**
   * Parses the JSON object a model wrote as text. The object may be wrapped in
   * a code fence or surrounded by a sentence, so the outermost braces are
   * taken. Throws a readable error when there is no JSON object.
   */
  protected parseStructuredOutputText(text: string): Record<string, unknown> {
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    if (start === -1 || end < start) {
      throw new Error(`Structured output is not a JSON object: ${text.slice(0, 200)}`)
    }
    let parsed: unknown
    try {
      // Text that starts with `{` and ends with `}` only parses to an object.
      parsed = JSON.parse(text.slice(start, end + 1))
    } catch (error) {
      throw new Error(
        `Structured output is not valid JSON: ${error instanceof Error ? error.message : error}`,
      )
    }
    return parsed as Record<string, unknown>
  }
}
