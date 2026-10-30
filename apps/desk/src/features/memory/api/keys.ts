export const memoryKeys = {
  all: ["memories"] as const,
  agent: (agentId: string) => [...memoryKeys.all, agentId] as const,
}
