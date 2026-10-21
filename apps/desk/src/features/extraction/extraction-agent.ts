/** The extraction agent a page works with, as its routes name it. */
export type ExtractionAgentRef = {
  organizationId: string
  projectId: string
  agentId: string
}

/** The agent's part of a route's params. */
export const agentParamsOf = (agent: ExtractionAgentRef) => ({
  organizationId: agent.organizationId,
  projectId: agent.projectId,
  agentId: agent.agentId,
})
