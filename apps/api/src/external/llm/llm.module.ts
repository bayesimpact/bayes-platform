import { AgentProvider } from "@caseai-connect/api-contracts"
import { Module, type Type } from "@nestjs/common"
import type { LLMProvider } from "@/common/interfaces/llm-provider.interface"
import { AISDKGemmaProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-gemma.provider"
import { AISDKMedGemmaProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-med-gemma.provider"
import { AISDKMistralProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mistral.provider"
import { AISDKMockProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mock.provider"
import { AISDKQwenProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-qwen.provider"
import { AISDKVertexProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-vertex.provider"
import { AISDKVertex3Provider } from "@/external/llm/ai-sdk/providers/ai-sdk-vertex3.provider"

const LLM_AVAILABLE_PROVIDERS = {
  [AgentProvider._Mock]: AISDKMockProvider,
  [AgentProvider.Vertex]: AISDKVertexProvider,
  [AgentProvider.Vertex3]: AISDKVertex3Provider,
  [AgentProvider.Mistral]: AISDKMistralProvider,
  [AgentProvider.MedGemma]: AISDKMedGemmaProvider,
  [AgentProvider.Gemma]: AISDKGemmaProvider,
  [AgentProvider.Qwen]: AISDKQwenProvider,
} satisfies Record<AgentProvider, Type<LLMProvider>>

export const LLM_PROVIDERS = "LLMProviders"
export type LlmProviders = Record<AgentProvider, LLMProvider>

const agentProviders = Object.keys(LLM_AVAILABLE_PROVIDERS) as AgentProvider[]
const providerClasses = agentProviders.map(
  (agentProvider) => LLM_AVAILABLE_PROVIDERS[agentProvider],
)

@Module({
  providers: [
    ...providerClasses,
    {
      provide: LLM_PROVIDERS,
      inject: providerClasses,
      useFactory: (...providers: LLMProvider[]): LlmProviders =>
        Object.fromEntries(
          agentProviders.map((agentProvider, index) => [agentProvider, providers[index]]),
        ) as LlmProviders,
    },
  ],
  exports: [...providerClasses, LLM_PROVIDERS],
})
export class LlmModule {}
