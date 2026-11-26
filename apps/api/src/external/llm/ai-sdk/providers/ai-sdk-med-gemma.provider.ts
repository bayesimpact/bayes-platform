import { createOpenResponses } from "@ai-sdk/open-responses"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModelV3 } from "@ai-sdk/provider"
import { AgentModel, type AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import { Injectable, NotImplementedException } from "@nestjs/common"
import { z } from "zod"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import {
  defineModelOptions,
  type ModelInfos,
  type ModelOptions,
} from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKVllmProviderBase } from "@/external/llm/ai-sdk/providers/ai-sdk-vllm-provider-base"
import { CustomMedGemmaLanguageModel } from "@/external/llm/ai-sdk/providers/medgemma/custom-med-gemma-language-model"
import type { ModelEndpointSettings } from "@/external/llm/workspace-models/model-endpoint.types"

type MedGemmaAgentModel = AgentModelOf<AgentProvider.MedGemma>

@Injectable()
export class AISDKMedGemmaProvider extends AISDKVllmProviderBase<AgentProvider.MedGemma> {
  protected readonly providerName = "Medgemma Provider"

  getAgentProvider(): AgentProvider.MedGemma {
    return AgentProvider.MedGemma
  }

  protected readonly modelOptions: Record<MedGemmaAgentModel, ModelOptions> = {
    [AgentModel.MedGemma10_27B]: defineModelOptions(
      z.object({ temperature: z.number().min(0).max(2) }),
      {
        temperature: 0,
      },
    ),
  }
  protected readonly modelInfos: Record<MedGemmaAgentModel, ModelInfos> = {
    // Replaced by Gemma 4, which serves the same projects on the same platform.
    [AgentModel.MedGemma10_27B]: {
      deprecation: {
        deprecatedOn: "2026-10-23",
        recommendedReplacement: AgentModel.Gemma4_26B,
      },
    },
  }
  /** MedGemma uses a different API depending on the call. */
  override getLanguageModel({
    config,
    callOrigin,
    endpoint,
  }: {
    config: LLMConfig
    callOrigin: CallOrigin
    endpoint?: ModelEndpointSettings
  }): LanguageModelV3 {
    switch (callOrigin) {
      case CallOrigin.generateText:
        return this.getOpenResponsesProvider(config, endpoint)
      case CallOrigin.streamChatResponse:
        return this.getOpenAiProvider(config, endpoint)
      case CallOrigin.generateStructuredOutput:
      case CallOrigin.streamChatResponse_withTools:
        return this.getCustomProvider(config, endpoint)
      default:
        throw new NotImplementedException(`DEV - Unknown callOrigin: ${callOrigin}`)
    }
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

(CRITICAL) To call a tool, you MUST output valid JSON exactly like this:
        {type:"tool", name: "toolName", arguments: '{"key1": "value1", "key2": "value2", ... , "keyX": "valueX" }'}
(CRITICAL) If no tool call is required, you MUST output your answer following exactly the output JSON format :
        {type:"answer", content: '<your answer here>'}`
    }

    return systemPrompt
  }

  getOpenResponsesProvider(config: LLMConfig, endpoint?: ModelEndpointSettings): LanguageModelV3 {
    const { url, apiKey, modelName } = this.getModelSettings(config.model, endpoint)
    return createOpenResponses({
      name: this.providerName,
      url: new URL("v1/responses", url).toString(),
      apiKey,
      fetch: this.fetchForEndpoint(config, endpoint),
    })(modelName)
  }
  getOpenAiProvider(config: LLMConfig, endpoint?: ModelEndpointSettings): LanguageModelV3 {
    const { url, apiKey, modelName } = this.getModelSettings(config.model, endpoint)
    return createOpenAI({
      name: this.providerName,
      baseURL: new URL("v1", url).toString(),
      apiKey,
      fetch: this.fetchForEndpoint(config, endpoint),
    })(modelName)
  }
  getCustomProvider(config: LLMConfig, endpoint?: ModelEndpointSettings): LanguageModelV3 {
    const { url, apiKey, modelName } = this.getModelSettings(config.model, endpoint)
    return new CustomMedGemmaLanguageModel({
      config: { ...config, model: modelName },
      baseUrl: url,
      apiKey,
      fetch: this.fetchForEndpoint(config, endpoint),
    }) as LanguageModelV3
  }
  /** MedGemma does not honour the response format: the object is read from its text. */
  protected override readStructuredOutput(result: {
    text: string
    output: Record<string, unknown>
  }): Record<string, unknown> {
    return this.parseStructuredOutputText(result.text)
  }
}
