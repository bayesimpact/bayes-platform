import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"

export function getAgentModelKey(model: string) {
  return Object.keys(AgentModel).find((key) => AgentModel[key as keyof typeof AgentModel] === model)
}

/** Gemma and MedGemma are image-only models: pdfs must be sent as images. */
export const modelRequiresPdfAsImages = (model: AgentModel | string): boolean => {
  const provider = AgentModelToAgentProvider[model as AgentModel]
  return provider === AgentProvider.Gemma || provider === AgentProvider.MedGemma
}
