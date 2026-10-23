import type { JSONSchema7 } from "ai"
import type {
  LLMCallContext,
  LLMChatMessage,
  LLMConfig,
  SpecificProviderOptions,
  TelemetryMetadata,
} from "@/common/interfaces/llm-provider.interface"
import { removeNullish } from "@/common/utils/remove-nullish"
import { flattenToSpanAttributes, type SpanAttributes } from "@/external/llm/span-attributes"

export type { SpecificProviderOptions } from "@/common/interfaces/llm-provider.interface"

export abstract class AISDKLLMBuilders {
  protected buildFunctionIdForStreamChatResponse(aiSDKMessages: LLMChatMessage[]): string {
    return `LLMProvider.streamChatResponse [${aiSDKMessages.filter((m) => m.role === "assistant").length + 1} turn(s)]` //+1 => current turn
  }

  /**
   * Text of the last user message, so a trace backend can show the turn's
   * question instead of the whole prompt.
   */
  protected buildUserMessageForTelemetry(aiSDKMessages: LLMChatMessage[]): string | undefined {
    const lastUserMessage = [...aiSDKMessages].reverse().find((message) => message.role === "user")
    if (!lastUserMessage) return undefined
    if (typeof lastUserMessage.content === "string") return lastUserMessage.content
    const text = lastUserMessage.content
      .map((part) => (part.type === "text" ? part.text : `[${part.type}]`))
      .join("\n")
    return text || undefined
  }

  protected buildMetadata({
    config,
    callContext,
    schema,
    telemetryMetadata,
  }: {
    config: LLMConfig
    callContext: LLMCallContext
    schema?: JSONSchema7
    telemetryMetadata: TelemetryMetadata
  }): SpanAttributes {
    return removeNullish({
      // Our trace id groups all the turns of a run; the trace backend shows it
      // as a session, and TRACE_URL_TEMPLATE links to it by this id.
      sessionId: callContext.traceId,
      agentSessionId: callContext.agentSessionId,
      parentSessionId: callContext.parentSessionId,
      userId: `o:${callContext.organizationId} / p:${callContext.projectId}`,
      currentTurn: callContext.currentTurn,
      revision: callContext.revision,
      outputSchema: JSON.stringify(schema),
      availableTools: JSON.stringify(config.tools),
      spanLabel: callContext.spanLabel,
      // The context above keeps its keys: the trace backend reads sessionId and userId as is.
      ...flattenToSpanAttributes(telemetryMetadata),
    })
  }

  /** See {@link SpecificProviderOptions}. */
  protected abstract buildSpecificProviderOptions(args: {
    config: LLMConfig
  }): SpecificProviderOptions
}
