import type { AgentParamsDto } from "@bayes-platform/eval-contracts"

/**
 * The page of an agent in the Studio, on the app's origin, where the agent is set up: apps/web
 * serves it.
 */
export const studioAgentPathOf = ({ organizationId, projectId, agentId }: AgentParamsDto) =>
  `/studio/o/${organizationId}/p/${projectId}/a/${agentId}`
