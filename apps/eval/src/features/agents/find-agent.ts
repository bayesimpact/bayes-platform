import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import {
  chooseDefaultAgent,
  type EvaluationAgent,
  type EvaluationProjectAgents,
  flattenEvaluationAgents,
} from "./evaluation-agents"

/** The agent of a URL, when the person can evaluate it and it sits in that project. */
export function findAgent(
  groups: EvaluationProjectAgents[],
  params: AgentParamsDto,
): EvaluationAgent | null {
  return (
    flattenEvaluationAgents(groups).find(
      (agent) =>
        agent.id === params.agentId &&
        agent.project.id === params.projectId &&
        agent.project.organization.id === params.organizationId,
    ) ?? null
  )
}

/** The agent a project's URL opens: the last one opened when it is in the project, else its first. */
export function findProjectDefaultAgent(
  groups: EvaluationProjectAgents[],
  params: Omit<AgentParamsDto, "agentId">,
  lastAgentId: string | null,
): EvaluationAgent | null {
  const group = groups.find(
    (candidate) =>
      candidate.project.id === params.projectId &&
      candidate.project.organization.id === params.organizationId,
  )
  return group ? chooseDefaultAgent(group.agents, lastAgentId) : null
}

/** The path params of an agent's pages. */
export function agentPathParams(agent: EvaluationAgent): AgentParamsDto {
  return {
    organizationId: agent.project.organization.id,
    projectId: agent.project.id,
    agentId: agent.id,
  }
}
