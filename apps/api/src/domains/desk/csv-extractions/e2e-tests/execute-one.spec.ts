import { randomUUID } from "node:crypto"
import { DeskCsvExtractionsRoutes } from "@bayes-platform/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import {
  createCsvExtractionRun,
  createCsvExtractionRunContext,
} from "@/domains/agents/csv-extraction-runs/e2e-tests/csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "@/domains/agents/csv-extraction-runs/e2e-tests/setup"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk CSV extractions - executeOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentCsvExtractionRunId: string
  let authSubject = "oidc|123"

  const mockBatchService = buildMockBatchService()
  const mockFileStorageService = buildMockFileStorageService()

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) =>
        applyCsvExtractionRunOverrides(moduleBuilder, () => authSubject, {
          batchService: mockBatchService,
          fileStorageService: mockFileStorageService,
        }),
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

  const createContext = async () => {
    const context = await createCsvExtractionRunContext({ repositories, authSubject })
    const run = await createCsvExtractionRun({
      repositories,
      context,
      status: "pending",
      type: "live",
    })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    agentCsvExtractionRunId = run.id
    authSubject = context.user.authSubject!
  }

  const subject = async (body: unknown) =>
    request({
      route: DeskCsvExtractionsRoutes.executeOne,
      pathParams: { organizationId, projectId, agentId, agentCsvExtractionRunId },
      token: "token",
      body,
    })

  it("enqueues an execute-run job and returns the run", async () => {
    await createContext()

    const response = await subject({ payload: { recordLimit: null } })

    expectSchemaResponse(DeskCsvExtractionsRoutes.executeOne, response, 201)
    expect(response.body.data.id).toBe(agentCsvExtractionRunId)
    expect(mockBatchService.enqueueExecuteRun).toHaveBeenCalledTimes(1)
    expect(mockBatchService.enqueueExecuteRun).toHaveBeenCalledWith({
      agentCsvExtractionRunId,
      organizationId,
      projectId,
      recordLimit: null,
    })

    await expectActivityCreated("agentCsvExtractionRun.execute")
  })

  it("forwards recordLimit to the enqueued job", async () => {
    await createContext()

    const response = await subject({ payload: { recordLimit: 5 } })

    expectResponse(response, 201)
    expect(mockBatchService.enqueueExecuteRun).toHaveBeenCalledWith({
      agentCsvExtractionRunId,
      organizationId,
      projectId,
      recordLimit: 5,
    })
  })

  it("answers 400 with no body", async () => {
    // The Desk schema requires the body; the live route reads an absent one as no limit.
    await createContext()

    expectResponse(await subject(undefined), 400)
    expect(mockBatchService.enqueueExecuteRun).not.toHaveBeenCalled()
  })

  it("returns 404 for a non-existent run", async () => {
    await createContext()
    agentCsvExtractionRunId = randomUUID()

    expectResponse(await subject({ payload: { recordLimit: null } }), 404)
    expect(mockBatchService.enqueueExecuteRun).not.toHaveBeenCalled()
  })
})
