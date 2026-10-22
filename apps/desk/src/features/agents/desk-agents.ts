import type { AgentTypeDto, ProjectAgentOutputDto } from "@caseai-connect/desk-contracts"
import { notFound } from "@tanstack/react-router"
import type { DeskProject } from "./desk-projects"

/** An agent the person can use in the Desk, with its project and organization. */
export type DeskAgent = Pick<ProjectAgentOutputDto, "id" | "name" | "type"> & {
  project: DeskProject
}

/** A page made for another type of agent is not found: its URL may name any agent. */
export function requireAgentType(agent: DeskAgent, type: AgentTypeDto): void {
  if (agent.type !== type) throw notFound()
}

/** Whether the agent's project shows the sources a reply relied on (its `sources-tool` feature). */
export const hasSourcesTool = (agent: DeskAgent): boolean =>
  agent.project.featureFlags.includes("sources-tool")

/** The agents of a project, in the order the menu shows them. */
export type DeskProjectAgents = {
  project: DeskProject
  agents: DeskAgent[]
}

/**
 * The agents of every Desk project, grouped by project in the order of `listDeskProjects`, with
 * the agents in the API's order (by name). A project with no agent is left out.
 */
export function groupDeskAgents(
  projects: DeskProject[],
  agentsOfProjects: ProjectAgentOutputDto[][],
): DeskProjectAgents[] {
  return projects.flatMap((project, index) => {
    const agents = (agentsOfProjects[index] ?? []).map((agent) => ({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      project,
    }))
    return agents.length > 0 ? [{ project, agents }] : []
  })
}

/** Every agent of the groups, in the menu's order. */
export function flattenDeskAgents(groups: DeskProjectAgents[]): DeskAgent[] {
  return groups.flatMap((group) => group.agents)
}

/**
 * The agent the Desk opens on: the last one the person opened, when it is still theirs, else the
 * first one of the menu. `null` when the person has no agent.
 */
export function chooseDefaultAgent(
  agents: DeskAgent[],
  lastAgentId: string | null,
): DeskAgent | null {
  return agents.find((agent) => agent.id === lastAgentId) ?? agents[0] ?? null
}
