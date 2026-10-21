import type { AgentProvider } from "@caseai-connect/api-contracts"
import { Logger } from "@nestjs/common"
import { trace } from "@opentelemetry/api"
import { generateText, jsonSchema, Output, ToolLoopAgent } from "ai"
import type {
  LLMChatMessage,
  LLMConfig,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import { removeNullish } from "@/common/utils/remove-nullish"
import { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import { AISDKLLMFetchMgmt } from "@/external/llm/ai-sdk/ai-sdk-llm-fetch-mgmt"
import type { AISDKLLMModelMgmt } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import type { LeakedToolCall } from "@/external/llm/ai-sdk/ai-sdk-llm-tools-mgmt"

const logger = new Logger("AISDKLLMProviderBase")

// Upper bound on the tokens one streamed step can generate, reasoning
// included. A model can loop on one token without end (observed with Gemma
// 4 after a tool call): without a bound, the generation runs for minutes.
export const MAX_STREAM_OUTPUT_TOKENS = 16384

/**
 * The calls a provider answers through the AI SDK: a streamed chat turn, a
 * plain text generation and a structured output. Everything about the model
 * itself (choice, options, middleware, output cleaning) lives in
 * {@link AISDKLLMModelMgmt}, and the fetch it is reached through in
 * {@link AISDKLLMFetchMgmt}.
 */
export abstract class AISDKLLMProviderBase<Provider extends AgentProvider = AgentProvider>
  extends AISDKLLMFetchMgmt<Provider>
  implements LLMProvider
{
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
    const aiSDKMessages = this.toConversationMessages(messages, "stream response")

    const systemMessage = messages.find((msg) => msg.role === "system")?.content
    const functionId = this.buildFunctionIdForStreamChatResponse(aiSDKMessages)
    const tags = this.getTelemetryMetadata(config)
    // Request-scoped: tool calls the model verbalized in the text channel
    // instead of emitting them. Collected by the raw-capture middleware and
    // recovered after the stream (see recoverLeakedToolCalls).
    const leakedToolCalls: LeakedToolCall[] = []
    const modelWithoutLeakedToolCalls = this.getLanguageModelWithRawCapture({
      config,
      callOrigin,
      metadata,
    })

    const systemPrompt = this.applySpecificToSystemPrompt({
      systemPrompt: systemMessage || config.systemPrompt || "",
      config,
      callOrigin,
    })

    const agent = new ToolLoopAgent({
      model: this.getLanguageModelWithRawCapture({ config, callOrigin, metadata, leakedToolCalls }),
      // Passed as instructions, not as a system message in `messages`: the AI SDK
      // warns on every call otherwise (prompt injection risk).
      ...(systemPrompt ? { instructions: systemPrompt } : {}),
      maxOutputTokens: MAX_STREAM_OUTPUT_TOKENS,
      tools: this.supportsStrictTools() ? this.withStrictTools(config.tools) : config.tools,
      stopWhen: this.buildStopConditions(config),
      // Arguments the model broke (invalid JSON) are regenerated through
      // structured output instead of being lost.
      experimental_repairToolCall: this.buildToolCallRepair({
        model: modelWithoutLeakedToolCalls,
        config,
        metadata,
        functionId,
        tags,
      }),
      experimental_telemetry: {
        isEnabled: true,
        functionId,
        metadata: removeNullish({
          ...this.buildMetadata({ config, metadata, tags }),
          userMessage: this.buildUserMessageForTelemetry(aiSDKMessages),
        }),
      },
      ...this.buildSpecificProviderOptions({ config }),
    })

    const streamResult = await agent.stream({ messages: aiSDKMessages })

    // The AI SDK never throws stream failures at the consumer: they surface
    // as `error` parts on fullStream, which textStream filters out — the
    // stream just ends, indistinguishable from an empty answer. Consume
    // fullStream so a failed generation rejects and callers can report it.
    //
    // Some models (Gemma) write their message, call a tool in the same step,
    // then write the very same message again once the tool result comes
    // back. The steps are stored as one reply, so the user would read it
    // twice: the filter drops a step's text when it repeats the previous
    // step's text word for word.
    const repeatedStepTextFilter = this.createRepeatedStepTextFilter()
    for await (const part of streamResult.fullStream) {
      if (part.type === "error") throw part.error
      const text = repeatedStepTextFilter.feed(part)
      if (text.length > 0) yield text
    }
    const remainingText = repeatedStepTextFilter.flush()
    if (remainingText.length > 0) yield remainingText
    const droppedBlocks = repeatedStepTextFilter.dropped()
    if (droppedBlocks.length > 0) {
      logger.warn("Dropped text the model repeated after a tool result", {
        model: config.model,
        blocks: droppedBlocks.length,
        characters: droppedBlocks.reduce((total, block) => total + block.length, 0),
      })
      trace.getActiveSpan()?.setAttribute("llm.repeated_step_text.blocks", droppedBlocks.length)
    }
    await this.recoverLeakedToolCalls({
      model: modelWithoutLeakedToolCalls,
      config,
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
    const tags = this.getTelemetryMetadata(config)
    const { text } = await generateText({
      model: this.getLanguageModelWithRawCapture({ config, callOrigin, metadata }),
      system: config.systemPrompt,
      prompt,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "LLMProvider.generateText",
        metadata: this.buildMetadata({ config, metadata, tags }),
      },
      ...this.buildSpecificProviderOptions({ config }),
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
    message = this.applySpecificToStructuredOutputMessage({ message, config })

    const aiSDKMessages = this.toConversationMessages([message], "generate structured output")
    const tags = this.getTelemetryMetadata(config)
    const result = await generateText({
      model: this.getLanguageModelWithRawCapture({ config, callOrigin, metadata }),
      messages: aiSDKMessages,
      system: config.systemPrompt,
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
      ...this.buildSpecificProviderOptions({ config }),
    })
    return this.readStructuredOutput(result)
  }

  /**
   * The messages sent to the model: system messages are left out (the system
   * prompt is passed apart) and every other message is sent as an assistant
   * or a user message. Throws when no message is left.
   */
  private toConversationMessages(messages: LLMChatMessage[], action: string): LLMChatMessage[] {
    const conversationMessages = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })) as LLMChatMessage[]
    if (conversationMessages.length === 0) {
      throw new Error(`Cannot ${action}: no valid messages provided`)
    }
    return conversationMessages
  }
}
