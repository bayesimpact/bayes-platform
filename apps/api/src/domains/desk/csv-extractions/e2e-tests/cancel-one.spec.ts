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
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk CSV extractions - cancelOne", () => {
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

  const createContext = async ({
    status = "running",
  }: {
    status?: "pending" | "running" | "completed"
  } = {}) => {
    const context = await createCsvExtractionRunContext({ repositories, authSubject })
    const run = await createCsvExtractionRun({ repositories, context, status, type: "live" })

    // A still-running record so the cancel path has a pending job to remove.
    const runningRecord = await repositories.agentCsvExtractionRunRecordRepository.save(
      agentCsvExtractionRunRecordFactory
        .transient({
          organization: context.organization,
          project: context.project,
          agentCsvExtractionRun: run,
        })
        .build({ status: "running", rowIndex: 0 }),
    )

    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    agentCsvExtractionRunId = run.id
    authSubject = context.user.authSubject!

    return { runningRecord }
  }

  const subject = async () =>
    request({
      route: DeskCsvExtractionsRoutes.cancelOne,
      pathParams: { organizationId, projectId, agentId, agentCsvExtractionRunId },
      token: "token",
    })

  it("marks a running run cancelled, removes pending jobs and stores the export", async () => {
    const { runningRecord } = await createContext({ status: "running" })

    const response = await subject()

    expectSchemaResponse(DeskCsvExtractionsRoutes.cancelOne, response, 201)
    expect(response.body.data.status).toBe("cancelled")
    // The jobs are removed without waiting: wait for the mock's own promise.
    await mockBatchService.removePendingRunRecords.mock.results[0]?.value
    expect(mockBatchService.removePendingRunRecords).toHaveBeenCalled()
    expect(mockFileStorageService.save).toHaveBeenCalledTimes(1)

    const persisted = await repositories.agentCsvExtractionRunRepository.findOneOrFail({
      where: { id: agentCsvExtractionRunId },
    })
    expect(persisted.status).toBe("cancelled")
    expect(persisted.csvExportDocumentId).not.toBeNull()

    const persistedRecord = await repositories.agentCsvExtractionRunRecordRepository.findOneOrFail({
      where: { id: runningRecord.id },
    })
    expect(persistedRecord.status).toBe("cancelled")

    await expectActivityCreated("agentCsvExtractionRun.cancel")
  })

  it("returns 422 when the run is already completed", async () => {
    await createContext({ status: "completed" })

    expectResponse(await subject(), 422)

    const persisted = await repositories.agentCsvExtractionRunRepository.findOneOrFail({
      where: { id: agentCsvExtractionRunId },
    })
    expect(persisted.status).toBe("completed")
  })

  it("returns 404 for a non-existent run", async () => {
    await createContext()
    agentCsvExtractionRunId = randomUUID()

    expectResponse(await subject(), 404)
  })
})
