import "../open-telemetry-init" // !!!! first import !!!!
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModelV3 } from "@ai-sdk/provider"
import { AgentProvider } from "@caseai-connect/api-contracts"
import { Injectable, NotImplementedException } from "@nestjs/common"
import { GoogleAuth } from "google-auth-library"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { GetAgentModelKeyFromValue } from "@/external/llm/agent-provider"
import { AISDKLLMProviderBase, CallOrigin } from "@/external/llm/ai-sdk-llm-provider-base"
import { GemmaPromptHelper } from "@/external/llm/providers/gemma/gemma-prompt-helper"

@Injectable()
export class AISDKGemmaProvider extends AISDKLLMProviderBase {
  getAgentProvider(): AgentProvider {
    return AgentProvider.Gemma
  }
  private readonly providerName: string

  constructor() {
    super()
    this.providerName = "Gemma Provider"
  }
  getLanguageModel({
    config,
    callOrigin,
  }: {
    config: LLMConfig
    callOrigin: CallOrigin
  }): LanguageModelV3 {
    switch (callOrigin) {
      case CallOrigin.generateText:
      case CallOrigin.generateChatResponse:
      case CallOrigin.generateObject:
      case CallOrigin.streamChatResponse:
      case CallOrigin.generateStructuredOutput:
      case CallOrigin.streamChatResponse_withTools:
        return this.getOpenAiProvider(config)
      default:
        throw new NotImplementedException(`DEV - Unknown callOrigin: ${callOrigin}`)
    }
  }

  getOpenAiProvider(config: LLMConfig): LanguageModelV3 {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    })
    const { url, apiKey } = this.getModelEnvSettings(config.model)
    return createOpenAI({
      name: this.providerName,
      baseURL: url,
      apiKey,
      fetch: async (requestUrl, init) => {
        const client = await auth.getClient()
        const { token } = await client.getAccessToken()
        const headers = new Headers(init?.headers)
        headers.set("Authorization", `Bearer ${token}`)
        return fetch(requestUrl, {
          ...init,
          headers,
        })
      },
    }).chat(config.model)
  }

  override applySpecificToSystemPrompt({
    config,
    systemPrompt,
    callOrigin,
  }: {
    config: LLMConfig
    systemPrompt: string
    callOrigin: CallOrigin
  }): string {
    if (callOrigin === CallOrigin.streamChatResponse_withTools && config.tools) {
      return GemmaPromptHelper.appendToolsToPrompt({ prompt: systemPrompt, tools: config.tools })
    }

    return systemPrompt
  }

  getModelEnvSettings(model: string) {
    const agentModelKey = GetAgentModelKeyFromValue(model)
    const envKeyUrl = `VLLM_${agentModelKey?.toUpperCase()}_URL`
    if (!process.env[envKeyUrl])
      throw new NotImplementedException(`DEV - Missing environment variable: ${envKeyUrl}`)
    const envKeyApiKey = `VLLM_${agentModelKey?.toUpperCase()}_APIKEY`
    if (!process.env[envKeyApiKey])
      throw new NotImplementedException(`DEV - Missing environment variable: ${envKeyApiKey}`)
    return { url: process.env[envKeyUrl], apiKey: process.env[envKeyApiKey] }
  }
  getTags(config: LLMConfig): string[] {
    return [this.providerName, config.model]
  }
}
