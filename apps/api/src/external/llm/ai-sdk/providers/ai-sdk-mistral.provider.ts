import { AgentModel, type AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import type { FilePart } from "ai"
import { z } from "zod"
import type { LLMChatMessage, LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import { defineModelOptions, type ModelOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKVllmProviderBase } from "@/external/llm/ai-sdk/providers/ai-sdk-vllm-provider-base"

type MistralAgentModel = AgentModelOf<AgentProvider.Mistral>

@Injectable()
export class AISDKMistralProvider extends AISDKVllmProviderBase<AgentProvider.Mistral> {
  protected readonly providerName = "Mistral Provider"

  protected readonly modelOptions: Record<MistralAgentModel, ModelOptions> = {
    [AgentModel.MistralSmall31_24B]: defineModelOptions(z.object({ temperature: z.number() }), {
      temperature: 0,
    }),
  }

  getAgentProvider(): AgentProvider.Mistral {
    return AgentProvider.Mistral
  }

  protected override applySpecificToSystemPrompt({
    config,
    systemPrompt,
    callOrigin,
  }: {
    config: LLMConfig
    systemPrompt: string
    callOrigin: CallOrigin
  }): string {
    if (callOrigin === CallOrigin.streamChatResponse_withTools && config.tools) {
      const toolDocs = this.describeToolsForPrompt(config.tools)
      if (!toolDocs) return systemPrompt
      return `${systemPrompt}

##TOOLS
You have access to the following tools:
${toolDocs.join("\n")}

(CRITICAL) If a parameters allows null, set the value to null when unknown. Set to null not to quoted "null"`
    }

    return systemPrompt
  }

  /** Mistral does not read PDF files. */
  protected override applySpecificToStructuredOutputMessage({
    message,
  }: {
    message: LLMChatMessage
    config: LLMConfig
  }): LLMChatMessage {
    if (Array.isArray(message.content)) {
      const filePart = message.content.find((part): part is FilePart => part.type === "file")
      if (filePart?.mediaType === "application/pdf") {
        throw new Error(`Model cannot process ${filePart.mediaType} file`)
      }
    }
    return message
  }
}
