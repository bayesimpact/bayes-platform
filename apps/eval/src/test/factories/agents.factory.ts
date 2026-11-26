import {
  type AgentVersionOutputDto,
  agentVersionOutputSchema,
  type MyProjectOutputDto,
  type ProjectAgentOutputDto,
  projectAgentOutputSchema,
} from "@bayes-platform/eval-contracts"

/** An agent of `GET eval/.../projects/:projectId/agents`, checked against the contract. */
export function buildProjectAgent(
  project: MyProjectOutputDto,
  overrides: Partial<ProjectAgentOutputDto> = {},
): ProjectAgentOutputDto {
  return projectAgentOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "Helpful Assistant",
    type: "conversation",
    projectId: project.id,
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

/** The instructions of each mocked version: each one adds a rule to the one before. */
const INSTRUCTIONS_BY_REVISION = [
  "You are a helpful assistant. Answer the customer's questions about the product.",
  "You are a helpful assistant. Answer the customer's questions about the product.\nUse the product catalog to name the right plan.",
  "You are a helpful assistant. Answer the customer's questions about the product.\nUse the product catalog to name the right plan.\nAnswer in the customer's language.",
  "You are a helpful assistant. Answer the customer's questions about the product.\nUse the product catalog to name the right plan.\nAnswer in the customer's language.\nAnswer in three sentences at most.",
]

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
    instructions: INSTRUCTIONS_BY_REVISION[0],
    greetingMessage: "Hello! How can I help you today?",
    model: "gemini-2.5-flash",
    providerOptions: {},
    documentsRagMode: "all",
    fillFormEnabled: false,
    priorityCallsEnabled: false,
    variables: null,
    embeddingModel: "text-embedding-005",
    followUpSuggestionsEnabled: false,
    followUpSuggestionsInstructions: null,
    followUpSuggestionsMax: 3,
    ...overrides,
  })
}

/**
 * The versions of an agent, as its settings history lists them, newest first: a draft, a saved
 * version newer than the one in production, the one in production, and two older ones. Each one
 * changes a few fields of the one before.
 */
export function buildAgentVersions(agent: ProjectAgentOutputDto): AgentVersionOutputDto[] {
  const [first, second, third, fourth] = INSTRUCTIONS_BY_REVISION
  return [
    buildAgentVersion(agent, 5, {
      isDraft: true,
      updatedAt: Date.now(),
      instructions: fourth,
      model: "gemini-2.5-pro",
      followUpSuggestionsEnabled: true,
    }),
    buildAgentVersion(agent, 4, {
      name: "Shorter answers",
      description: "Answers in three sentences at most.",
      instructions: fourth,
      model: "gemini-2.5-pro",
    }),
    buildAgentVersion(agent, PRODUCTION_REVISION, {
      name: "Spring release",
      description: "Answers in the customer's language.",
      instructions: third,
      greetingMessage: "Hello! Ask me anything about our plans.",
    }),
    buildAgentVersion(agent, 2, {
      name: "Product catalog",
      instructions: second,
      documentsRagMode: "tags",
    }),
    buildAgentVersion(agent, 1, { instructions: first }),
  ]
}
