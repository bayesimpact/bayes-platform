import {
  chooseDefaultAgent,
  type DeskAgent,
  type DeskProjectAgents,
  flattenDeskAgents,
} from "./desk-agents"

export type AgentParamsDto = {
  organizationId: string
  projectId: string
  agentId: string
}

/** The agent of a URL, when the person can use it and it sits in that project. */
export function findAgent(groups: DeskProjectAgents[], params: AgentParamsDto): DeskAgent | null {
  return (
    flattenDeskAgents(groups).find(
      (agent) =>
        agent.id === params.agentId &&
        agent.project.id === params.projectId &&
        agent.project.organization.id === params.organizationId,
    ) ?? null
  )
}

/** The agent a project's URL opens: the last one opened when it is in the project, else its first. */
export function findProjectDefaultAgent(
  groups: DeskProjectAgents[],
  params: Omit<AgentParamsDto, "agentId">,
  lastAgentId: string | null,
): DeskAgent | null {
  const group = groups.find(
    (candidate) =>
      candidate.project.id === params.projectId &&
      candidate.project.organization.id === params.organizationId,
  )
  return group ? chooseDefaultAgent(group.agents, lastAgentId) : null
}

/** The path params of an agent's pages. */
export function agentPathParams(agent: DeskAgent): AgentParamsDto {
  return {
    organizationId: agent.project.organization.id,
    projectId: agent.project.id,
    agentId: agent.id,
  }
}
