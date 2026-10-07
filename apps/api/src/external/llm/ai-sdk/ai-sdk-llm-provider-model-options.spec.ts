import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import type { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"
import { AISDKGemmaProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-gemma.provider"
import { AISDKMedGemmaProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-med-gemma.provider"
import { AISDKMistralProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mistral.provider"
import { AISDKMockProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mock.provider"
import { AISDKVertexProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-vertex.provider"
import { AISDKVertex3Provider } from "@/external/llm/ai-sdk/providers/ai-sdk-vertex3.provider"

const providers: { [Provider in AgentProvider]: AISDKLLMProviderBase<Provider> } = {
  [AgentProvider.Gemma]: new AISDKGemmaProvider(),
  [AgentProvider.MedGemma]: new AISDKMedGemmaProvider(),
  [AgentProvider.Mistral]: new AISDKMistralProvider(),
  [AgentProvider.Vertex]: new AISDKVertexProvider(),
  [AgentProvider.Vertex3]: new AISDKVertex3Provider(),
  [AgentProvider._Mock]: new AISDKMockProvider(),
}

describe("AISDKLLMProviderBase model options", () => {
  it.each(Object.values(AgentModel))("%s values conform to its schema", (agentModel) => {
    const provider = providers[AgentModelToAgentProvider[agentModel]]

    const schema = provider.getProviderOptionsSchema(agentModel)
    const values = provider.getProviderOptions(agentModel)

    expect(schema.parse(values)).toEqual(values)
  })
})
