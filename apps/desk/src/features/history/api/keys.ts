export const historyKeys = {
  all: ["history"] as const,
  agent: (agentId: string) => [...historyKeys.all, agentId] as const,
  conversations: (agentId: string) => [...historyKeys.agent(agentId), "conversations"] as const,
  extractionRuns: (agentId: string) => [...historyKeys.agent(agentId), "extraction-runs"] as const,
  csvExtractionRuns: (agentId: string) =>
    [...historyKeys.agent(agentId), "csv-extraction-runs"] as const,
  extractionDocuments: (agentId: string) =>
    [...historyKeys.agent(agentId), "extraction-documents"] as const,
}
