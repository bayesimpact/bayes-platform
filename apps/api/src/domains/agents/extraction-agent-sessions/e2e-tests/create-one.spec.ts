import { randomUUID } from "node:crypto"
import { AgentModel, ExtractionAgentSessionsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import type { Document } from "@/domains/documents/document.entity"
import { documentFactory } from "@/domains/documents/document.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { AISDKMockProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mock.provider"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsModule } from "../../agents.module"
import { EXTRACTION_AGENT_SESSION_BATCH_SERVICE } from "../extraction-agent-session-batch.interface"

const mockLlmProvider = {
  streamChatResponse: jest.fn(),
  generateStructuredOutput: jest.fn(),
}

/** A batch service whose queue interactions are stubbed out (no Redis/BullMQ). */
const mockBatchService = {
  enqueueExecuteRun: jest.fn().mockResolvedValue(undefined),
}

describe("ExtractionAgentSessionsRoutes.createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let documentId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => authSubject)
          .overrideProvider(AISDKMockProvider)
          .useValue(mockLlmProvider)
          .overrideProvider(EXTRACTION_AGENT_SESSION_BATCH_SERVICE)
          .useValue(mockBatchService),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = "oidc|123"
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** The document is a file uploaded for a run, by the caller unless `uploadedBy` says otherwise. */
  const createContext = async ({
    sourceType = "extraction",
    uploadedBy = "caller",
  }: {
    sourceType?: Document["sourceType"]
    uploadedBy?: "caller" | "colleague"
  } = {}) => {
    const { user, organization, project, agent } = await createOrganizationWithAgent(repositories, {
      agent: {
        type: "extraction",
      },
      agentSettings: {
        model: AgentModel._Mock,
        outputJsonSchema: {
          type: "object",
          properties: { fullName: { type: "string" } },
          required: ["fullName"],
        },
      },
    })

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
  }

  const subject = async () =>
    request({
      route: ExtractionAgentSessionsRoutes.playground.executeOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: { payload: { documentId } },
    })

  it("should create an extraction session run", async () => {
    await createContext()
    mockLlmProvider.generateStructuredOutput.mockResolvedValue({ fullName: "Jane Doe" })

    const response = await subject()
    expectResponse(response, 201)
    expect(response.body.data.runId).toBeDefined()
    expect(mockBatchService.enqueueExecuteRun).toHaveBeenCalledWith({
      extractionAgentSessionId: response.body.data.runId,
      organizationId,
      projectId,
    })

    await expectActivityCreated("extractionAgentSession.execute")
  })

  describe("the document a run reads", () => {
    it("lets a playground run read any document of the project", async () => {
      await createContext({ sourceType: "project", uploadedBy: "colleague" })

      expectResponse(await subject(), 201)
      expect(mockBatchService.enqueueExecuteRun).toHaveBeenCalledTimes(1)
    })

    it("answers 404 for a document of another project", async () => {
      await createContext()
      const { organization: otherOrganization, project: otherProject } =
        await createOrganizationWithProject(repositories)
      const otherDocument = await repositories.documentRepository.save(
        documentFactory
          .transient({ organization: otherOrganization, project: otherProject })
          .build({ sourceType: "extraction" }),
      )
      documentId = otherDocument.id

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
  })
})
