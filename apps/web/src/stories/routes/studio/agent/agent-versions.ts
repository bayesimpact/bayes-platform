import type { CreateAgentSettingsDto } from "@caseai-connect/api-contracts"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import type { IAgentSettingsSpi } from "@/common/features/agents/agent-settings/agent-settings.spi"
import type { Agent } from "@/common/features/agents/agents.models"

const DAY = 1000 * 60 * 60 * 24

/** Names and changes of the saved revisions, oldest first, so the history reads like a real one. */
const savedRevisionSamples = [
  { name: "Initial setup", instructions: "You are a helpful assistant." },
  {
    name: "Friendlier tone",
    instructions: "You are a helpful assistant.\nKeep a friendly, clear tone.",
  },
  {
    name: "Stricter sourcing",
    instructions:
      "You are a helpful assistant.\nKeep a friendly, clear tone.\nAlways cite your sources.",
  },
  {
    name: "Shorter answers",
    instructions:
      "You are a helpful assistant.\nKeep a friendly, clear tone.\nAlways cite your sources.\nAnswer in three sentences at most.",
  },
  {
    name: "Pricing questions",
    instructions:
      "You are a helpful assistant.\nKeep a friendly, clear tone.\nAlways cite your sources.\nAnswer in three sentences at most.\nSend pricing questions to the sales team.",
  },
]

/**
 * A settings history of `savedCount` saved revisions, newest first, with `productionRevision` in
 * production (the newest saved one by default) and an optional draft on top. Returns the agent
 * with `currentRevision` and `draftRevision` matching it, as the agents endpoint would.
 */
export function buildAgentVersions({
  agent,
  base,
  savedCount,
  productionRevision = savedCount,
  withDraft = false,
}: {
  agent: Agent
  base: AgentSettings
  savedCount: number
  productionRevision?: number
  withDraft?: boolean
}): { agent: Agent; versions: AgentSettings[] } {
  const saved = Array.from({ length: savedCount }, (_, index) => {
    const revision = index + 1
    const sample = savedRevisionSamples[index % savedRevisionSamples.length]
    return {
      ...base,
      revision,
      isDraft: false,
      isProduction: revision === productionRevision,
      name: sample?.name ?? "",
      description: "",
      instructions: sample?.instructions ?? base.instructions,
      updatedAt: Date.now() - (savedCount - index + 1) * DAY,
    } satisfies AgentSettings
  }).reverse()
  const latest = saved[0]
  const draft: AgentSettings[] =
    withDraft && latest
      ? [
          {
            ...latest,
            revision: savedCount + 1,
            isDraft: true,
            isProduction: false,
            name: "",
            instructions: `${latest.instructions}\nOffer a next step at the end of each answer.`,
            updatedAt: Date.now() - 1000 * 60 * 20,
          },
        ]
      : []
  const versions = [...draft, ...saved]
  return { agent: withRevisions(agent, versions), versions }
}

/** The agent's `currentRevision` and `draftRevision`, read from its history. */
function withRevisions(agent: Agent, versions: AgentSettings[]): Agent {
  const production = versions.find((version) => version.isProduction)
  const draft = versions.find((version) => version.isDraft)
  return {
    ...agent,
    currentRevision: production
      ? {
          number: production.revision,
          name: production.name,
          description: production.description,
          updatedAt: production.updatedAt,
          greetingMessage: production.greetingMessage,
        }
      : undefined,
    draftRevision: draft
      ? { number: draft.revision, name: draft.name, updatedAt: draft.updatedAt }
      : undefined,
  }
}

/**
 * In-memory backend for one agent's versions: saving a version and changing the production one
 * resolve and update what the next fetch returns. The story store runs no listener middleware,
 * so the page does not refetch on its own. Every change builds new objects: the store freezes
 * what it receives.
 */
export function buildAgentVersionsBackend(initial: { agent: Agent; versions: AgentSettings[] }) {
  let versions = initial.versions
  let agent = initial.agent

  const commit = (nextVersions: AgentSettings[]) => {
    versions = nextVersions
    agent = withRevisions(agent, versions)
  }
  const setProduction = (revision: number) =>
    commit(versions.map((version) => ({ ...version, isProduction: version.revision === revision })))

  const agentSettings: IAgentSettingsSpi = {
    getAllWithDraft: async () => versions,
    getFillFormOutputJsonSchema: async ({ revision }) =>
      versions.find((version) => version.revision === revision)?.outputJsonSchema,
    setProduction: async ({ revision }) => {
      setProduction(revision)
      return { success: true }
    },
    createOne: async ({ revision }, payload: CreateAgentSettingsDto) => {
      const isFirstVersion = !versions.some((version) => version.isProduction)
      commit(
        versions.map((version) =>
          version.revision === revision
            ? {
                ...version,
                isDraft: false,
                name: payload.revisionName ?? "",
                description: payload.revisionDesc ?? "",
              }
            : version,
        ),
      )
      if (isFirstVersion || payload.setAsProduction) setProduction(revision)
      return { success: true }
    },
    restoreOne: async () => {
      throw new Error("restoreOne is not supported in this story")
    },
    // The editor saves each change by itself: the story accepts the save and keeps its seeded
    // data, so the forms must hold what the user typed.
    updateOne: async () => ({ success: true }),
  }

  return { agentSettings, getAgent: () => agent, getVersions: () => versions }
}
