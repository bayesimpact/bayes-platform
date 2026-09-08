import type { LanguageModelV3 } from "@ai-sdk/provider"
import { AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { NotImplementedException } from "@nestjs/common"
import { trace } from "@opentelemetry/api"
import {
  type FilePart,
  generateText,
  jsonSchema,
  Output,
  stepCountIs,
  ToolLoopAgent,
  wrapLanguageModel,
} from "ai"
import type {
  LLMChatMessage,
  LLMConfig,
  LLMFile,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import {
  CallOrigin,
  extractTextFromContent,
  extractTextFromStreamChunks,
  RAW_LLM_REQUEST_ATTR,
  RAW_LLM_RESPONSE_ATTR,
  RAW_LLM_RESPONSE_STRIPPED_ATTR,
} from "@/external/llm/ai-sdk-llm-common"
import { AISDKLLMToolsMgmt } from "@/external/llm/ai-sdk-llm-tools-mgmt"
import { fireAndForgetStopCondition } from "@/external/llm/fire-and-forget-stop-condition"
import { ResponseHelper } from "@/external/llm/response-helper"
import { withStrictTools } from "@/external/llm/strict-tools"
import { type LeakedToolCall, ThoughtTokensHelper } from "@/external/llm/thought-tokens-helper"

export abstract class AISDKLLMProviderBase extends AISDKLLMToolsMgmt implements LLMProvider {
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
    const functionId = this.buildFunctionIdForStreamChatResponse(aiSDKMessages)
    const tags = this.getTags(config)
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
        metadata: this.buildMetadata({ config, metadata, tags }),
      },
      providerOptions: this.buildProviderOptions({ config, callOrigin, metadata, tags }),
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
    const model = this.getLanguageModelWithRawCapture({ config, callOrigin })
    await this.runEndOfTurnTools({
      model,
      config,
      callOrigin,
      metadata,
      functionId,
      messages: fullMessages,
      streamResult,
      tags,
    })

    await this.recoverLeakedToolCalls({
      model,
      config,
      callOrigin,
      metadata,
      functionId,
      leakedToolCalls,
      streamResult,
      tags,
    })
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
    const tags = this.getTags(config)
    const { text } = await generateText({
      model: this.getLanguageModelWithRawCapture({ config, callOrigin }),
      system: config.systemPrompt,
      prompt,
      temperature: config.temperature,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "LLMProvider.generateText",
        metadata: this.buildMetadata({ config, metadata, tags }),
      },
      providerOptions: this.buildProviderOptions({ config, callOrigin, metadata, tags }),
    })
    return text
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
    const tags = this.getTags(config)
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
          tags,
        }),
      },
      providerOptions: this.buildProviderOptions({
        config,
        callOrigin,
        metadata,
        schema,
        tags,
      }),
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

  private checkConfigProviderAndModel(config: LLMConfig): void {
    const provider = AgentModelToAgentProvider[config.model]
    if (provider !== this.getAgentProvider())
      throw new NotImplementedException(
        `DEV - missing or invalid association between agent provider (${provider}) and agent model (${config.model})`,
      )
  }

  abstract getLanguageModel({ config, callOrigin }: { config: LLMConfig; callOrigin: CallOrigin })
  abstract getTags(config: LLMConfig): string[]
  abstract getAgentProvider(): AgentProvider

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
