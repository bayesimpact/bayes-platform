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

// The self-hosted Gemma backend has, on multiple occasions, stopped producing any output
// mid-generation without erroring - the request just hangs forever with no timeout of its own,
// leaving the parent HTTP request (and the end user) stuck indefinitely. Bound both halves of the
// exchange: the initial connect (no response at all) and each gap between streamed chunks (a
// response that starts, then stalls). A per-call value generous enough to never trip on a real,
// slow-but-progressing generation (the longest observed in practice is ~19s).
const GEMMA_FETCH_TIMEOUT_MS = 45_000

/**
 * Wraps a fetch Response so its body stream aborts with an error if no new chunk arrives within
 * `idleTimeoutMs` of the previous one (or of the response starting). Guards against a response
 * that starts fine but then stalls mid-stream - a plain AbortSignal.timeout on the initial fetch
 * call alone would not catch this, since that promise has already resolved by then.
 */
function withIdleTimeout(response: Response, idleTimeoutMs: number): Response {
  if (!response.body) return response
  const reader = response.body.getReader()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let timeoutId: ReturnType<typeof setTimeout>
      const resetIdleTimer = () => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          controller.error(
            new Error(`Gemma provider: no data received for ${idleTimeoutMs}ms, aborting stalled stream`),
          )
          reader.cancel().catch(() => {})
        }, idleTimeoutMs)
      }
      resetIdleTimer()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            clearTimeout(timeoutId)
            controller.close()
            return
          }
          resetIdleTimer()
          controller.enqueue(value)
        }
      } catch (error) {
        clearTimeout(timeoutId)
        controller.error(error)
      }
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => {})
    },
  })
  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

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
        return this.getOpenAiCompatibilityModeProvider(config)
      default:
        throw new NotImplementedException(`DEV - Unknown callOrigin: ${callOrigin}`)
    }
  }

  getOpenAiCompatibilityModeProvider(config: LLMConfig): LanguageModelV3 {
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

        const connectTimeout = AbortSignal.timeout(GEMMA_FETCH_TIMEOUT_MS)
        const response = await fetch(requestUrl, {
          ...init,
          headers,
          signal: init?.signal ? AbortSignal.any([init.signal, connectTimeout]) : connectTimeout,
        })
        return withIdleTimeout(response, GEMMA_FETCH_TIMEOUT_MS)
      },
    }).chat(config.model)
  }
  // getOpenResponsesProvider(config: LLMConfig): LanguageModelV3 {
  //   const { url, apiKey } = this.getModelEnvSettings(config.model)
  //   return createOpenResponses({
  //     name: this.providerName,
  //     url: new URL("v1/responses", url).toString(),
  //     apiKey,
  //   })(config.model)
  // }
  // getOpenAiProvider(config: LLMConfig): LanguageModelV3 {
  //   const { url, apiKey } = this.getModelEnvSettings(config.model)
  //   return createOpenAI({
  //     name: this.providerName,
  //     baseURL: new URL("v1", url).toString(),
  //     apiKey,
  //   })(config.model)
  // }

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
      return GemmaPromptHelper.injectNullValueInstruction({
        prompt: systemPrompt,
        tools: config.tools,
      })
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
