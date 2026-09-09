import type { JSONValue } from "@ai-sdk/provider"
import type { JSONSchema7 } from "ai"
import type {
  LLMChatMessage,
  LLMConfig,
  LLMMetadata,
} from "@/common/interfaces/llm-provider.interface"
import { removeNullish } from "@/common/utils/remove-nullish"
import type { CallOrigin } from "@/external/llm/ai-sdk-llm-common"

export abstract class AISDKLLMBuilders {
  protected buildFunctionIdForStreamChatResponse(aiSDKMessages: LLMChatMessage[]): string {
    return `LLMProvider.streamChatResponse [${aiSDKMessages.filter((m) => m.role === "assistant").length + 1} turn(s)]` //+1 => current turn
  }

  protected buildMetadata({
    config,
    metadata,
    schema,
    tags,
  }: {
    config: LLMConfig
    metadata: LLMMetadata
    schema?: JSONSchema7
    tags: string[]
  }): Record<string, string | number | string[]> {
    return removeNullish({
      langfuseTraceId: metadata.traceId,
      sessionId: `as:${metadata.langfuseSessionId ?? metadata.agentSessionId}`,
      userId: `o:${metadata.organizationId} / p:${metadata.projectId}`,
      tags: [...(metadata?.tags || []), ...tags],
      currentTurn: metadata.currentTurn,
      revision: metadata.revision,
      outputSchema: JSON.stringify(schema),
      availableTools: JSON.stringify(config.tools),
    })
  }

  protected buildCustomProviderOptions({
    config,
    callOrigin,
    metadata,
    schema,
    tags,
  }: {
    config: LLMConfig
    callOrigin: CallOrigin
    metadata: LLMMetadata
    schema?: JSONSchema7
    tags: string[]
  }) {
    return {
      callOrigin,
      agentId: metadata.agentId,
      metadata: this.buildMetadata({ config, metadata, schema, tags }),
    }
  }

  protected buildProviderOptions(args: {
    config: LLMConfig
    callOrigin: CallOrigin
    metadata: LLMMetadata
    schema?: JSONSchema7
    tags: string[]
  }) {
    return {
      custom: this.buildCustomProviderOptions(args),
      ...this.buildNativeProviderOptions({ config: args.config }),
    }
  }

  protected buildNativeProviderOptions(_args: {
    config: LLMConfig
  }): Record<string, Record<string, JSONValue>> {
    return {}
  }
}
