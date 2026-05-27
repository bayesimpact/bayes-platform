import type { LanguageModelV3 } from "@ai-sdk/provider"
import { AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { NotImplementedException } from "@nestjs/common"
import { trace } from "@opentelemetry/api"
import {
  type FilePart,
  generateText,
  type JSONSchema7,
  jsonSchema,
  Output,
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

// OTel attribute keys under which we publish the raw LLM request body and
// response. The `ai.telemetry.metadata.` prefix is required so the AI SDK
// accepts the attribute and so LangfuseIntegrationExporter picks it up.
// The exporter recognises these specific keys and surfaces them together
// as a dedicated child span (named "llm.call") under each generation,
// with the request as input and the response as output, instead of
// burying them in the metadata blob.
export const RAW_LLM_REQUEST_ATTR = "ai.telemetry.metadata.rawLlmRequest"
export const RAW_LLM_RESPONSE_ATTR = "ai.telemetry.metadata.rawLlmResponse"

export abstract class AISDKLLMProviderBase implements LLMProvider {
  protected getLanguageModelWithRawCapture(args: {
    config: LLMConfig
    callOrigin: CallOrigin
  }): LanguageModelV3 {
    const baseModel = this.getLanguageModel(args)
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
            activeSpan?.setAttribute(
              RAW_LLM_RESPONSE_ATTR,
              typeof raw === "string" ? raw : JSON.stringify(raw),
            )
          } catch {
            // never let telemetry capture break the generation
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
          const transformed = stream.pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                rawChunks.push(chunk)
                controller.enqueue(chunk)
              },
              flush() {
                try {
                  const grouped = groupStreamChunksForReadability(rawChunks)
                  trace
                    .getActiveSpan()
                    ?.setAttribute(RAW_LLM_RESPONSE_ATTR, JSON.stringify(grouped))
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

    const agent = new ToolLoopAgent({
      model: this.getLanguageModelWithRawCapture({ config, callOrigin }),
      temperature: config.temperature,
      tools: config.tools,
      experimental_telemetry: {
        isEnabled: true,
        functionId: this.buildFunctionIdForStreamChatResponse(aiSDKMessages),
        metadata: this.buildMetadata({ config, metadata }),
      },
      providerOptions: {
        custom: { callOrigin, metadata: this.buildMetadata({ config, metadata }) },
      },
    })

    let systemPrompt = systemMessage || config.systemPrompt || ""
    systemPrompt = this.applySpecificToSystemPrompt({ systemPrompt, config, callOrigin })
    const systemMessagePart = systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }]
      : []

    const streamer = agent.stream({
      messages: [...systemMessagePart, ...aiSDKMessages],
    })

    const stripper = createChannelStripper()
    for await (const chunk of (await streamer).textStream) {
      const clean = stripper.feed(chunk)
      if (clean) yield clean
    }
    const tail = stripper.flush()
    if (tail) yield tail
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
        custom: { callOrigin, metadata: this.buildMetadata({ config, metadata }) },
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
        custom: { callOrigin, metadata: this.buildMetadata({ config, metadata }) },
      },
    })
    const { answer } = extractThoughtAndAnswer(text)
    return answer
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
        custom: {
          callOrigin,
          metadata: this.buildMetadata({
            config,
            metadata,
            schema: schema.toJSONSchema() as JSONSchema7,
          }),
        },
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
    //Gemma restriction: no pdf
    if (AgentModelToAgentProvider[config.model] === AgentProvider.Gemma) {
      if (Array.isArray(message.content)) {
        const filePart = message.content.find((p): p is FilePart => p.type === "file")
        if (filePart?.mediaType === "application/pdf") {
          throw new Error(`MedGemma model cannot process ${filePart?.mediaType} file`)
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
        custom: {
          callOrigin,
          metadata: this.buildMetadata({
            config,
            metadata,
            schema,
          }),
        },
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
        `missing or invalid association between agent provider (${provider}) and agent model (${config.model})`,
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
      sessionId: `as:${metadata.agentSessionId}`,
      userId: `o:${metadata.organizationId} / p:${metadata.projectId}`,
      tags: [...this.getTags(config), ...(metadata?.tags || [])],
      currentTurn: metadata.currentTurn,
      outputSchema: JSON.stringify(schema),
      availableTools: JSON.stringify(config.tools),
    })
  }

  abstract getLanguageModel({ config, callOrigin }: { config: LLMConfig; callOrigin: CallOrigin })
  abstract getTags(config: LLMConfig): string[]
  abstract getAgentProvider(): AgentProvider

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

function groupStreamChunksForReadability(chunks: unknown[]): unknown[] {
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

// Channel-name keywords that Gemma 4 / GPT-OSS-style models emit as the name
// inside `<|channel>name<channel|>` openers. When such a name appears as a
// bare standalone line (between two marker pairs, after the opener has been
// stripped), we treat it as leaked-marker content and drop it too.
const CHANNEL_KEYWORDS = "thought|analysis|reasoning|finalize|commentary|final"

// Composite removals that need a full self-contained match. Safe to run on a
// partial streaming buffer because they only fire once both ends are present.
function stripPairedChannelMarkers(text: string): string {
  return (
    text
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
// streamed (e.g. removing `<|channel>` before `<channel|>` arrives leaves
// the channel name as visible content). Apply only to text we are
// committing to emit / at flush time.
function stripStrayChannelTokens(text: string): string {
  return text
    .replace(/<\|"\|>/g, "")
    .replace(/<\|[a-z0-9_-]*>/gi, "")
    .replace(/<[a-z0-9_-]*\|>/gi, "")
    .replace(/<unused\d+>/g, "")
}

export function extractThoughtAndAnswer(raw: string) {
  let answer = stripPairedChannelMarkers(raw)
  answer = stripStrayChannelTokens(answer)
  return { answer: answer.trim() }
}
/**
 * Streaming-safe stripper for Gemma channel markers. A marker like
 * `<|channel>thought<channel|>` can be split across multiple stream deltas
 * (`<|`, `channel`, `>thought`, `<channel`, `|>`), so we cannot regex each
 * delta in isolation. This holds back a small tail of the most recent text
 * until we are confident no marker is still mid-emission, then emits the
 * cleaned prefix. Call `flush()` at end of stream.
 */
export function createChannelStripper() {
  let pending = ""
  // How many trailing characters to hold back from emission. Must be longer
  // than the longest marker we might want to recognise once its closer
  // arrives, so an in-progress marker is never split across two emits.
  const HOLD_TAIL = 64
  // Upper bound on the length of any single marker (`<|channel>thought<channel|>`
  // ≈ 30). When the planned cut point falls within this many characters of an
  // earlier `<`, we MUST pull the cut back to that `<`: otherwise we would
  // emit a partial marker (e.g. just `<`) and orphan its tail (`|"|>` etc.),
  // which subsequent regex passes can no longer match.
  const MAX_MARKER_LEN = 32

  return {
    feed(chunk: string): string {
      pending += chunk
      // Step 1: strip any FULLY PAIRED markers from the buffer.
      // Safe mid-stream: paired regexes only fire once both ends are present.
      pending = stripPairedChannelMarkers(pending)

      // Step 2: decide what is safe to emit.
      let safeUntil = pending.length - HOLD_TAIL
      if (safeUntil <= 0) return ""
      // If a `<` exists within MAX_MARKER_LEN chars before the planned cut,
      // it could be the start of a marker straddling the cut. Pull the cut
      // back to that `<` so the marker stays whole in `pending` for the
      // next feed (or for flush).
      const ltBeforeCut = pending.lastIndexOf("<", safeUntil - 1)
      if (ltBeforeCut !== -1 && safeUntil - ltBeforeCut < MAX_MARKER_LEN) {
        safeUntil = ltBeforeCut
      }
      if (safeUntil <= 0) return ""

      // Step 3: only the slice we are about to emit gets the stray-token
      // pass — by construction it cannot contain a partial marker now, so
      // any `<|...>` / `<...|>` fragments inside are definitively orphaned.
      const emit = stripStrayChannelTokens(pending.slice(0, safeUntil))
      pending = pending.slice(safeUntil)
      return emit
    },
    flush(): string {
      const tail = stripStrayChannelTokens(stripPairedChannelMarkers(pending))
      pending = ""
      return tail
    },
  }
}
