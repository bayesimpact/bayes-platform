import { randomUUID } from "node:crypto"
import { AgentModel } from "@bayes-platform/api-contracts"
import { DeskExtractionsRoutes } from "@bayes-platform/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { EXTRACTION_AGENT_SESSION_BATCH_SERVICE } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session-batch.interface"
import { documentFactory } from "@/domains/documents/document.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

/** A batch service whose queue interactions are stubbed out (no Redis/BullMQ). */
const mockBatchService = {
  enqueueExecuteRun: jest.fn().mockResolvedValue(undefined),
}

describe("Desk extractions - executeOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let agentId: string
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(EXTRACTION_AGENT_SESSION_BATCH_SERVICE)
          .useValue(mockBatchService),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  let documentId: string

  /** The document is a file uploaded for a run, by the caller unless `uploadedBy` says otherwise. */
  const createContext = async ({
    sourceType = "extraction",
    uploadedBy = "caller",
  }: {
    sourceType?: "extraction" | "project"
    uploadedBy?: "caller" | "colleague"
  } = {}) => {
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      {
        agent: { type: "extraction" },
        agentSettings: {
          model: AgentModel._Mock,
          outputJsonSchema: {
            type: "object",
            properties: { fullName: { type: "string" } },
            required: ["fullName"],
          },
        },
      },
    )
    const colleague = userFactory.build()
    if (uploadedBy === "colleague") await repositories.userRepository.save(colleague)
    const document = documentFactory.transient({ organization, project }).build({
      sourceType,
      userId: uploadedBy === "caller" ? user.id : colleague.id,
      mimeType: "application/pdf",
      storageRelativePath: "documents/sample.pdf",
    })
    await repositories.documentRepository.save(document)

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    documentId = document.id
    authSubject = user.authSubject!
    return { agentSettings }
  }

  const subject = async (body: unknown = { payload: { documentId } }) =>
    request({
      route: DeskExtractionsRoutes.executeOne,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
      body,
    })

  it("creates a live run on a file the caller uploaded, and queues it", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(DeskExtractionsRoutes.executeOne, response, 201)
    const runId = response.body.data.runId
    expect(mockBatchService.enqueueExecuteRun).toHaveBeenCalledWith({
      extractionAgentSessionId: runId,
      organizationId,
      projectId,
    })
    const run = await repositories.extractionAgentSessionRepository.findOneByOrFail({ id: runId })
    expect(run.type).toBe("live")
    expect(run.documentId).toBe(documentId)
    await expectActivityCreated("extractionAgentSession.execute")
  })

  it("runs on the version in production", async () => {
    const { agentSettings } = await createContext()

    const response = await subject()

    expectSchemaResponse(DeskExtractionsRoutes.executeOne, response, 201)
    const run = await repositories.extractionAgentSessionRepository.findOneByOrFail({
      id: response.body.data.runId,
    })
    expect(run.agentSettingsId).toBe(agentSettings.id)
  })

  it.each([
    { case: "a file a colleague uploaded for a run", uploadedBy: "colleague" },
    { case: "a document of the project", sourceType: "project" },
  ] as const)("answers 404 for a run on $case", async (document) => {
    await createContext(document)

    expectResponse(await subject(), 404, `Document ${documentId} not found`)
    expect(mockBatchService.enqueueExecuteRun).not.toHaveBeenCalled()
    expect(await repositories.extractionAgentSessionRepository.count()).toBe(0)
  })

  it("answers 404 for a document that does not exist", async () => {
    await createContext()
    documentId = randomUUID()

    expectResponse(await subject(), 404, `Document ${documentId} not found`)
    expect(mockBatchService.enqueueExecuteRun).not.toHaveBeenCalled()
  })

  it("refuses a settings version the Desk cannot choose", async () => {
    await createContext()

    expectResponse(await subject({ payload: { documentId, agentSettingsRevision: 1 } }), 400)
    expect(mockBatchService.enqueueExecuteRun).not.toHaveBeenCalled()
  })

  it("answers 422 when the agent is not an extraction agent", async () => {
    await createContext()
    await repositories.agentRepository.update({ id: agentId }, { type: "conversation" })

    expectResponse(await subject(), 422)
  })
})
