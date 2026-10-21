import { describe, expect, it } from "vitest"
import { agentFactory } from "@/common/features/agents/agent.factory"
import type { Agent } from "@/common/features/agents/agents.models"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"
import { agentSettingsFactory } from "./agent-settings.factory"
import type { AgentSettings } from "./agent-settings.models"
import { selectAgentSettingsDataByAgentId } from "./agent-settings.selectors"

const project = projectFactory.transient({ organization: organizationFactory.build() }).build()

/**
 * A fixture shaped like only the slices the selector reads, not a full `RootState` — the real type
 * is a many-scope union not meant to be hand-built.
 */
const buildState = (agent: Agent, history: AgentSettings[]) =>
  ({
    agents: { data: { status: ADS.Fulfilled, error: null, value: [agent] } },
    agentSettings: {
      history: { [agent.id]: { status: ADS.Fulfilled, error: null, value: history } },
    },
  }) as unknown as RootState

describe("selectAgentSettingsDataByAgentId", () => {
  it("reads the published revision, or the draft when asked to", () => {
    const agent = agentFactory
      .transient({ project })
      .build({ currentRevision: { number: 1 }, draftRevision: { number: 2 } })
    const published = agentSettingsFactory.transient({ agent }).build({ revision: 1 })
    const draft = agentSettingsFactory.transient({ agent }).build({ revision: 2, isDraft: true })
    const state = buildState(agent, [draft, published])

    expect(selectAgentSettingsDataByAgentId({ agentId: agent.id })(state).value).toBe(published)
    expect(
      selectAgentSettingsDataByAgentId({ agentId: agent.id, includeDraft: true })(state).value,
    ).toBe(draft)
  })

  it("reads the draft of an agent that was never published, such as a fresh copy", () => {
    const agent = agentFactory.unpublished().transient({ project }).build()
    const draft = agentSettingsFactory.transient({ agent }).build({ revision: 1, isDraft: true })
    const state = buildState(agent, [draft])

    expect(agent.currentRevision).toBeUndefined()
    expect(selectAgentSettingsDataByAgentId({ agentId: agent.id })(state).value).toBe(draft)
    expect(
      selectAgentSettingsDataByAgentId({ agentId: agent.id, includeDraft: true })(state).value,
    ).toBe(draft)
  })
})
