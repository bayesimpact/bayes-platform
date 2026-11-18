import type { ProjectAgentOutputDto } from "@caseai-connect/eval-contracts"
import type { EvaluationProject } from "./evaluation-projects"
import type { MyCampaign } from "./my-campaigns"

/** An agent the person can evaluate, with its project and organization. */
export type EvaluationAgent = Pick<ProjectAgentOutputDto, "id" | "name" | "type"> & {
  /** Whether the agent was published once: a review campaign runs the published version. */
  isPublished: boolean
  project: EvaluationProject
}

/** The agents of a project, in the order the menu shows them. */
export type EvaluationProjectAgents = {
  project: EvaluationProject
  agents: EvaluationAgent[]
}

/**
 * What the app holds for the person: the projects they evaluate or whose campaigns they manage,
 * their agents grouped by project, without the projects that have none, and the review campaigns
 * they test or review.
 */
export type EvaluationWorkspace = {
  projects: EvaluationProject[]
  groups: EvaluationProjectAgents[]
  myCampaigns: MyCampaign[]
}

/**
 * The agents of every project, grouped by project in the order of `listEvaluationProjects`, with
 * the agents in the API's order. A project with no agent is left out.
 */
export function groupEvaluationAgents(
  projects: EvaluationProject[],
  agentsOfProjects: ProjectAgentOutputDto[][],
): EvaluationProjectAgents[] {
  return projects.flatMap((project, index) => {
    const agents = (agentsOfProjects[index] ?? []).map((agent) => ({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      isPublished: agent.currentRevision !== undefined,
      project,
    }))
    return agents.length > 0 ? [{ project, agents }] : []
  })
}

/** Every agent of the groups, in the menu's order. */
export function flattenEvaluationAgents(groups: EvaluationProjectAgents[]): EvaluationAgent[] {
  return groups.flatMap((group) => group.agents)
}

/**
 * The agent the app opens on: the last one the person opened, when it is still theirs, else the
 * first one of the menu. `null` when the person has no agent.
 */
export function chooseDefaultAgent(
  agents: EvaluationAgent[],
  lastAgentId: string | null,
): EvaluationAgent | null {
  return agents.find((agent) => agent.id === lastAgentId) ?? agents[0] ?? null
}
