import { beforeEach, describe, expect, it, vi } from "vitest"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"
import type { Services } from "@/di/services"
import { documentFactory } from "@/studio/features/documents/documents.factory"
import { isStudioInterface } from "@/studio/routes/helpers"
import { extractionAgentSessionsThunks } from "./extraction-agent-sessions.thunks"

// `isStudioInterface` reads `window.location`, which doesn't exist under vitest's default node
// environment.
vi.mock("@/studio/routes/helpers", () => ({ isStudioInterface: vi.fn() }))

const mockedIsStudioInterface = vi.mocked(isStudioInterface)

const organizationId = "org-1"
const projectId = "project-1"
const agentId = "agent-1"

const organization = organizationFactory.build({ id: organizationId })
const project = projectFactory.transient({ organization }).build({ id: projectId })
const agent = agentFactory.transient({ project }).build({ id: agentId })
const document = documentFactory.transient({ project }).build({ id: "document-1" })

const executeOne = vi.fn()
const uploadDocument = vi.fn()
const extra = {
  services: { extractionAgentSessions: { executeOne, uploadDocument } } as unknown as Services,
}

/**
 * A fixture shaped like only the slices the thunk reads, not a full `RootState` — the real type is
 * a many-scope union not meant to be hand-built.
 */
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
  extractionAgentSessionsThunks.executeOne({ agentId, document, onSuccess: vi.fn() })(
    vi.fn(),
    () => state,
    extra,
  )

beforeEach(() => {
  vi.clearAllMocks()
  executeOne.mockResolvedValue({ runId: "run-1" })
  uploadDocument.mockResolvedValue(document)
})

describe("executeOne", () => {
  it("carries the chosen revision in Studio", async () => {
    mockedIsStudioInterface.mockReturnValue(true)
    // The draft sits at a different revision than the explicit choice below: if the thunk ignored
    // the choice and fell back to the draft-first default, it would send revision 3, not 1.
    const versions = [
      agentSettingsFactory.transient({ agent }).build({ revision: 3, isDraft: true }),
      agentSettingsFactory.transient({ agent }).build({ revision: 1 }),
    ]

    await run(buildState({ history: { [agentId]: versions }, chosenRevision: 1 }))

    expect(executeOne).toHaveBeenCalledWith(
      expect.objectContaining({ agentSettingsRevision: 1, type: "playground" }),
    )
  })

  it("defaults to the draft when no version was chosen", async () => {
    mockedIsStudioInterface.mockReturnValue(true)
    const versions = [
      agentSettingsFactory.transient({ agent }).build({ revision: 2, isDraft: true }),
      agentSettingsFactory.transient({ agent }).build({ revision: 1 }),
    ]

    await run(buildState({ history: { [agentId]: versions } }))

    expect(executeOne).toHaveBeenCalledWith(expect.objectContaining({ agentSettingsRevision: 2 }))
  })

  it("forwards no revision outside Studio even when one is chosen", async () => {
    mockedIsStudioInterface.mockReturnValue(false)
    const versions = [agentSettingsFactory.transient({ agent }).build({ revision: 2 })]

    await run(buildState({ history: { [agentId]: versions }, chosenRevision: 2 }))

    expect(executeOne).toHaveBeenCalledWith(
      expect.objectContaining({ agentSettingsRevision: undefined, type: "live" }),
    )
  })

  it("forwards no revision while the settings history has not loaded", async () => {
    mockedIsStudioInterface.mockReturnValue(true)

    await run(buildState())

    expect(executeOne).toHaveBeenCalledWith(
      expect.objectContaining({ agentSettingsRevision: undefined }),
    )
  })

  it("uploads a file through the extraction agent before running it", async () => {
    mockedIsStudioInterface.mockReturnValue(false)
    const file = new File(["content"], "invoice.pdf", { type: "application/pdf" })

    await extractionAgentSessionsThunks.executeOne({ agentId, file, onSuccess: vi.fn() })(
      vi.fn(),
      () => buildState(),
      extra,
    )

    expect(uploadDocument).toHaveBeenCalledWith({
      organizationId,
      projectId,
      agentId,
      type: "live",
      file,
    })
    expect(executeOne).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: document.id, type: "live" }),
    )
  })

  it("runs an already uploaded document without uploading again", async () => {
    mockedIsStudioInterface.mockReturnValue(false)

    await run(buildState())

    expect(uploadDocument).not.toHaveBeenCalled()
    expect(executeOne).toHaveBeenCalledWith(expect.objectContaining({ documentId: document.id }))
  })
})
