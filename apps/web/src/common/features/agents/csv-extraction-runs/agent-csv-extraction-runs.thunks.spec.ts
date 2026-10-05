import { beforeEach, describe, expect, it, vi } from "vitest"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"
import type { Services } from "@/di/services"
import { isStudioInterface } from "@/studio/routes/helpers"
import { agentCsvExtractionRunsThunks } from "./agent-csv-extraction-runs.thunks"

vi.mock("@/studio/routes/helpers", () => ({ isStudioInterface: vi.fn() }))

const mockedIsStudioInterface = vi.mocked(isStudioInterface)

const organizationId = "org-1"
const projectId = "project-1"
const agentId = "agent-1"

const organization = organizationFactory.build({ id: organizationId })
const project = projectFactory.transient({ organization }).build({ id: projectId })
const agent = agentFactory.transient({ project }).build({ id: agentId })

const createOne = vi.fn()
const executeOne = vi.fn()
const extra = {
  services: { agentCsvExtractionRuns: { createOne, executeOne } } as unknown as Services,
}

const columnSchema = {
  "col-title": {
    id: "col-title",
    originalName: "title",
    finalName: "title",
    role: "input" as const,
    index: 0,
  },
}

function buildState({
  history = {},
  chosenRevision,
}: {
  history?: Record<string, ReturnType<typeof agentSettingsFactory.build>[]>
  chosenRevision?: number
} = {}): RootState {
  return {
    currentIds: { organizationId, projectId, agentId },
    agentSettings: {
      history: Object.fromEntries(
        Object.entries(history).map(([historyAgentId, versions]) => [
          historyAgentId,
          { status: ADS.Fulfilled, error: null, value: versions },
        ]),
      ),
      playgroundRevisionByAgentId:
        chosenRevision === undefined ? {} : { [agentId]: chosenRevision },
    },
  } as unknown as RootState
}

const run = (state: RootState) =>
  agentCsvExtractionRunsThunks.createAndExecute({
    agentId,
    documentId: "document-1",
    columnSchema,
    recordLimit: null,
    onSuccess: vi.fn(),
  })(vi.fn(), () => state, extra)

beforeEach(() => {
  vi.clearAllMocks()
  createOne.mockResolvedValue({ id: "run-1" })
  executeOne.mockResolvedValue({ id: "run-1" })
})

describe("createAndExecute", () => {
  it("creates a playground run in Studio", async () => {
    // Each surface calls its own route set, so the Desk app never lists Studio experiments and
    // vice versa.
    mockedIsStudioInterface.mockReturnValue(true)

    await run(buildState())

    expect(createOne).toHaveBeenCalledWith(expect.objectContaining({ type: "playground" }))
    expect(executeOne).toHaveBeenCalledWith(expect.objectContaining({ type: "playground" }))
  })

  it("creates a live run outside Studio", async () => {
    mockedIsStudioInterface.mockReturnValue(false)

    await run(buildState())

    expect(createOne).toHaveBeenCalledWith(expect.objectContaining({ type: "live" }))
    expect(executeOne).toHaveBeenCalledWith(expect.objectContaining({ type: "live" }))
  })

  it("carries the chosen revision in Studio", async () => {
    mockedIsStudioInterface.mockReturnValue(true)
    // The draft sits at a different revision than the explicit choice below: if the thunk ignored
    // the choice and fell back to the draft-first default, it would send revision 3, not 1.
    const versions = [
      agentSettingsFactory.transient({ agent }).build({ revision: 3, isDraft: true }),
      agentSettingsFactory.transient({ agent }).build({ revision: 1 }),
    ]

    await run(buildState({ history: { [agentId]: versions }, chosenRevision: 1 }))

    expect(createOne).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ agentSettingsRevision: 1 }),
      }),
    )
  })

  it("defaults to the draft when no version was chosen", async () => {
    mockedIsStudioInterface.mockReturnValue(true)
    const versions = [
      agentSettingsFactory.transient({ agent }).build({ revision: 2, isDraft: true }),
      agentSettingsFactory.transient({ agent }).build({ revision: 1 }),
    ]

    await run(buildState({ history: { [agentId]: versions } }))

    expect(createOne).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ agentSettingsRevision: 2 }),
      }),
    )
  })

  it("forwards no revision outside Studio", async () => {
    mockedIsStudioInterface.mockReturnValue(false)
    const versions = [agentSettingsFactory.transient({ agent }).build({ revision: 2 })]

    await run(buildState({ history: { [agentId]: versions }, chosenRevision: 2 }))

    expect(createOne).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ agentSettingsRevision: undefined }),
      }),
    )
  })

  it("forwards no revision while the settings history has not loaded", async () => {
    mockedIsStudioInterface.mockReturnValue(true)

    await run(buildState())

    expect(createOne).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ agentSettingsRevision: undefined }),
      }),
    )
  })
})
