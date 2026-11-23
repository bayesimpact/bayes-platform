import { randomUUID } from "node:crypto"
import { DeskCsvExtractionsRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentCsvExtractionRunRecordFactory } from "@/domains/agents/csv-extraction-runs/agent-csv-extraction-run-record.factory"
import {
  createCsvExtractionRun,
  createCsvExtractionRunContext,
} from "@/domains/agents/csv-extraction-runs/e2e-tests/csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "@/domains/agents/csv-extraction-runs/e2e-tests/setup"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk CSV extractions - retryOne", () => {
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

  let context: Awaited<ReturnType<typeof createCsvExtractionRunContext>>

  const createContext = async () => {
    context = await createCsvExtractionRunContext({ repositories, authSubject })
    const run = await createCsvExtractionRun({ repositories, context, status: "failed" })
    await repositories.agentCsvExtractionRunRecordRepository.save(
      agentCsvExtractionRunRecordFactory
        .transient({
          organization: context.organization,
          project: context.project,
          agentCsvExtractionRun: run,
        })
        .build({ status: "error", rowIndex: 0, errorDetails: "boom" }),
    )
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    agentCsvExtractionRunId = run.id
    authSubject = context.user.authSubject!
  }

  const subject = async () =>
    request({
      route: DeskCsvExtractionsRoutes.retryOne,
      pathParams: { organizationId, projectId, agentId, agentCsvExtractionRunId },
      token: "token",
    })

  it("re-enqueues unfinished records and marks the run running", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(DeskCsvExtractionsRoutes.retryOne, response, 201)
    expect(response.body.data.id).toBe(agentCsvExtractionRunId)
    expect(response.body.data.status).toBe("running")
    expect(mockBatchService.retryRunRecords).toHaveBeenCalledTimes(1)

    const persisted = await repositories.agentCsvExtractionRunRepository.findOneOrFail({
      where: { id: agentCsvExtractionRunId },
    })
    expect(persisted.status).toBe("running")

    await expectActivityCreated("agentCsvExtractionRun.retry")
  })

  it("returns 404 for a non-existent run", async () => {
    await createContext()
    agentCsvExtractionRunId = randomUUID()

    expectResponse(await subject(), 404)
    expect(mockBatchService.retryRunRecords).not.toHaveBeenCalled()
  })

  it("re-enqueues against the version the run was pinned to, not the newest published one", async () => {
    await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({
          organization: context.organization,
          project: context.project,
          agent: context.agent,
        })
        .build({ revision: 2 }),
    )

    expectResponse(await subject(), 201)

    expect(mockBatchService.retryRunRecords).toHaveBeenCalledTimes(1)
    const [payloads] = mockBatchService.retryRunRecords.mock.calls[0]
    expect(payloads[0].agentWithSettings.settings.revision).toBe(context.agentSettings.revision)
  })
})
