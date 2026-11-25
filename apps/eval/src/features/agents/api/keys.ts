import type { AgentParamsDto } from "@bayes-platform/eval-contracts"

export const evaluationAgentKeys = {
  all: ["evaluation-agents"] as const,
  /** The saved versions of an agent's settings. */
  versions: (agent: AgentParamsDto) =>
    [...evaluationAgentKeys.all, "versions", agent.agentId] as const,
}
