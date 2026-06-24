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
import { documentFactory } from "@/domains/documents/document.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsModule } from "../../agents.module"
import { EXTRACTION_AGENT_SESSION_BATCH_SERVICE } from "../extraction-agent-session-batch.interface"

const mockLlmProvider = {
  streamChatResponse: jest.fn(),
  generateChatResponse: jest.fn(),
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
  let auth0Id = "auth0|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => auth0Id)
          .overrideProvider("_MockLLMProvider")
          .useValue(mockLlmProvider)
          .overrideProvider(EXTRACTION_AGENT_SESSION_BATCH_SERVICE)
          .useValue(mockBatchService),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project, agent } = await createOrganizationWithAgent(repositories, {
      agent: {
        type: "extraction",
        model: AgentModel._MockGenerateText,
        outputJsonSchema: {
          type: "object",
          properties: { fullName: { type: "string" } },
          required: ["fullName"],
        },
      },
    })

    const document = documentFactory.transient({ organization, project }).build({
      sourceType: "extraction",
      mimeType: "application/pdf",
      storageRelativePath: "documents/sample.pdf",
    })
    await repositories.documentRepository.save(document)

    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    documentId = document.id
    auth0Id = user.auth0Id
  }

  const subject = async (payload?: typeof ExtractionAgentSessionsRoutes.executeOne.request) =>
    request({
      route: ExtractionAgentSessionsRoutes.executeOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: payload ?? {
        payload: {
          documentId,
          type: "playground",
        },
      },
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
})
