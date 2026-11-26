import { MimeTypes } from "@bayes-platform/api-contracts"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import type { RootState } from "@/common/store"
import { ADS } from "@/common/store/async-data-status"
import type { Services } from "@/di/services"
import { documentFactory } from "@/studio/features/documents/documents.factory"
import { agentCsvExtractionRunsThunks } from "./agent-csv-extraction-runs.thunks"

const organizationId = "org-1"
const projectId = "project-1"
const agentId = "agent-1"

const organization = organizationFactory.build({ id: organizationId })
const project = projectFactory.transient({ organization }).build({ id: projectId })
const agent = agentFactory.transient({ project }).build({ id: agentId })

const createOne = vi.fn()
const executeOne = vi.fn()
const uploadDocument = vi.fn()
const extra = {
  services: {
    agentCsvExtractionRuns: { createOne, executeOne },
    extractionAgentSessions: { uploadDocument },
  } as unknown as Services,
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
  uploadDocument.mockResolvedValue(
    documentFactory
      .transient({ project })
      .build({ id: "document-csv", mimeType: MimeTypes.csv, sourceType: "extraction" }),
  )
})

describe("uploadCsvFile", () => {
  const file = new File(["title,summary\nFirst,One\n"], "sample.csv", { type: "text/csv" })

  it("uploads through the extraction agent routes", async () => {
    // Not through the project documents routes: a run document is not a project document, and
    // those routes are for owners and admins.
    const onSuccess = vi.fn()

    const action = await agentCsvExtractionRunsThunks.uploadCsvFile({ file, onSuccess })(
      vi.fn(),
      () => buildState(),
      extra,
    )

    expect(uploadDocument).toHaveBeenCalledWith({
      organizationId,
      projectId,
      agentId,
      file,
    })
    expect(action.payload).toBe("document-csv")
    expect(onSuccess).toHaveBeenCalledWith("document-csv")
  })
})

describe("createAndExecute", () => {
  it("creates the run on the current agent", async () => {
    // The Desk creates its live runs through its own endpoints, so what is left here is the
    // playground: a Studio experiment never shows up in the Desk.
    await run(buildState())

    expect(createOne).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId, projectId, agentId }),
    )
    expect(executeOne).toHaveBeenCalledWith(
      expect.objectContaining({ agentCsvExtractionRunId: "run-1" }),
    )
  })

  it("carries the chosen revision", async () => {
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

  it("forwards no revision while the settings history has not loaded", async () => {
    await run(buildState())

    expect(createOne).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ agentSettingsRevision: undefined }),
      }),
    )
  })
})
