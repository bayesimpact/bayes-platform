import {
  type AgentVersionOutputDto,
  agentVersionOutputSchema,
  type MyProjectOutputDto,
  type ProjectAgentOutputDto,
  projectAgentOutputSchema,
} from "@caseai-connect/eval-contracts"

/** An agent of `GET .../projects/:projectId/agents-with-drafts`, checked against the contract. */
export function buildProjectAgent(
  project: MyProjectOutputDto,
  overrides: Partial<ProjectAgentOutputDto> = {},
): ProjectAgentOutputDto {
  return projectAgentOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "Helpful Assistant",
    type: "conversation",
    projectId: project.id,
    // Published once, as a review campaign needs.
    currentRevision: {},
    ...overrides,
  })
}

const DAY = 24 * 60 * 60 * 1000

/** The version an agent's mocked campaigns run on, unless a test picks another. */
export const PRODUCTION_REVISION = 3

/**
 * The id of a version of an agent: the agent's id with the revision as its last digits, so a
 * campaign and the versions of its agent agree without a lookup.
 */
export function agentVersionIdOf(agent: ProjectAgentOutputDto, revision: number): string {
  return `${agent.id.slice(0, -4)}${revision.toString(16).padStart(4, "0")}`
}

/** A version of an agent's settings, saved unless `overrides` says otherwise. */
export function buildAgentVersion(
  agent: ProjectAgentOutputDto,
  revision: number,
  overrides: Partial<AgentVersionOutputDto> = {},
): AgentVersionOutputDto {
  return agentVersionOutputSchema.parse({
    id: agentVersionIdOf(agent, revision),
    revision,
    name: null,
    description: null,
    isDraft: false,
    isProduction: revision === PRODUCTION_REVISION,
    updatedAt: Date.now() - (5 - revision) * 15 * DAY,
    ...overrides,
  })
}

/**
 * The versions of an agent, as its settings history lists them, newest first: a draft, a saved
 * version newer than the one in production, the one in production, and two older ones.
 */
export function buildAgentVersions(agent: ProjectAgentOutputDto): AgentVersionOutputDto[] {
  return [
    buildAgentVersion(agent, 5, { isDraft: true, updatedAt: Date.now() }),
    buildAgentVersion(agent, 4, {
      name: "Shorter answers",
      description: "Answers in three sentences at most.",
    }),
    buildAgentVersion(agent, PRODUCTION_REVISION, {
      name: "Spring release",
      description: "Answers in the customer's language.",
    }),
    buildAgentVersion(agent, 2, { name: "Product catalog" }),
    buildAgentVersion(agent, 1),
  ]
}
