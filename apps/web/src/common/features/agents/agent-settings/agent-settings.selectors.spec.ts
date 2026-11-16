import { describe, expect, it } from "vitest"
import { agentFactory } from "@/common/features/agents/agent.factory"
import type { Agent } from "@/common/features/agents/agents.models"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"
import { agentSettingsFactory } from "./agent-settings.factory"
import type { AgentSettings } from "./agent-settings.models"
import {
  selectAgentSettingsDataByAgentId,
  selectPlaygroundAgentSettings,
} from "./agent-settings.selectors"

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

  // The agents list and the history load with two requests. After a save that creates or
  // deletes the draft, one is ahead of the other for a moment: the editor must stay on screen.
  it("reads the published revision while the agents list still names a deleted draft", () => {
    const agent = agentFactory
      .transient({ project })
      .build({ currentRevision: { number: 1 }, draftRevision: { number: 2 } })
    const published = agentSettingsFactory.transient({ agent }).build({ revision: 1 })
    const state = buildState(agent, [published])

    const selected = selectAgentSettingsDataByAgentId({ agentId: agent.id, includeDraft: true })(
      state,
    )

    expect(selected.status).toBe(ADS.Fulfilled)
    expect(selected.value).toBe(published)
  })

  it("reads the new draft while the agents list does not name it yet", () => {
    const agent = agentFactory.transient({ project }).build({ currentRevision: { number: 1 } })
    const published = agentSettingsFactory.transient({ agent }).build({ revision: 1 })
    const draft = agentSettingsFactory.transient({ agent }).build({ revision: 2, isDraft: true })
    const state = buildState(agent, [draft, published])

    expect(
      selectAgentSettingsDataByAgentId({ agentId: agent.id, includeDraft: true })(state).value,
    ).toBe(draft)
    expect(selectAgentSettingsDataByAgentId({ agentId: agent.id })(state).value).toBe(published)
  })

  it("reads the production revision, and the newest saved one for the editor", () => {
    const agent = agentFactory.transient({ project }).build({ currentRevision: { number: 1 } })
    const production = agentSettingsFactory
      .transient({ agent })
      .build({ revision: 1, isProduction: true })
    const newestSaved = agentSettingsFactory.transient({ agent }).build({ revision: 2 })
    const state = buildState(agent, [newestSaved, production])

    expect(selectAgentSettingsDataByAgentId({ agentId: agent.id })(state).value).toBe(production)
    expect(
      selectAgentSettingsDataByAgentId({ agentId: agent.id, includeDraft: true })(state).value,
    ).toBe(newestSaved)
  })
})

describe("selectPlaygroundAgentSettings", () => {
  const buildStateWithSlice = (agent: Agent, history: AgentSettings[]) =>
    ({
      agentSettings: {
        history: { [agent.id]: { status: ADS.Fulfilled, error: null, value: history } },
        playgroundRevisionByAgentId: {},
      },
    }) as unknown as RootState

  it("reads the settings of the revision the playground runs, draft-first", () => {
    const agent = agentFactory
      .transient({ project })
      .build({ currentRevision: { number: 1 }, draftRevision: { number: 2 } })
    const published = agentSettingsFactory.transient({ agent }).build({ revision: 1 })
    const draft = agentSettingsFactory.transient({ agent }).build({ revision: 2, isDraft: true })

    expect(
      selectPlaygroundAgentSettings({ agentId: agent.id })(
        buildStateWithSlice(agent, [draft, published]),
      ),
    ).toBe(draft)
  })

  it("returns null, without throwing, when the agentSettings slice is absent from the store", () => {
    // The desk store registers no agentSettings slice at all.
    const state = {} as unknown as RootState
    const agent = agentFactory.transient({ project }).build()

    expect(selectPlaygroundAgentSettings({ agentId: agent.id })(state)).toBeNull()
  })
})
