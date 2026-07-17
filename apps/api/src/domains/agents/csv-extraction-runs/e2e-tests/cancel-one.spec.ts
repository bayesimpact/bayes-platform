import { AgentCsvExtractionRunsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { agentCsvExtractionRunRecordFactory } from "../agent-csv-extraction-run-record.factory"
import { AgentCsvExtractionRunsModule } from "../agent-csv-extraction-runs.module"
import { createCsvExtractionRun, createCsvExtractionRunContext } from "./csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "./setup"

describe("AgentCsvExtractionRuns - cancelOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let agentId: string
  let agentCsvExtractionRunId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"

  const mockBatchService = buildMockBatchService()
  const mockFileStorageService = buildMockFileStorageService()

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [AgentCsvExtractionRunsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        applyCsvExtractionRunOverrides(moduleBuilder, () => auth0Id, {
          batchService: mockBatchService,
          fileStorageService: mockFileStorageService,
        }),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    jest.clearAllMocks()
    accessToken = "token"
    auth0Id = "auth0|123"
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  const createContext = async ({
    status = "running",
  }: {
    status?: "pending" | "running" | "completed"
  } = {}) => {
    const context = await createCsvExtractionRunContext({ repositories, auth0Id })
    const run = await createCsvExtractionRun({ repositories, context, status })

    // A still-running record so the cancel path has a pending job to remove.
    const runningRecord = agentCsvExtractionRunRecordFactory
      .transient({
        organization: context.organization,
        project: context.project,
        agentCsvExtractionRun: run,
      })
      .build({ status: "running", rowIndex: 0 })
    await repositories.agentCsvExtractionRunRecordRepository.save(runningRecord)

    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    agentCsvExtractionRunId = run.id
    auth0Id = context.user.auth0Id

    return { runningRecord }
  }

  const subject = async () =>
    request({
      route: AgentCsvExtractionRunsRoutes.cancelOne,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
      token: accessToken,
    })

  it("marks a running run cancelled and removes pending jobs", async () => {
    const { runningRecord } = await createContext({ status: "running" })

    const response = await subject()

    expectResponse(response, 201)
    expect(response.body.data.status).toBe("cancelled")
    // @ts-expect-error
    await mockBatchService.removePendingRunRecords.mock.results[0].value
    expect(mockBatchService.removePendingRunRecords).toHaveBeenCalled()

    const persisted = await repositories.agentCsvExtractionRunRepository.findOne({
      where: { id: agentCsvExtractionRunId },
    })
    expect(persisted?.status).toBe("cancelled")

    const persistedRecord = await repositories.agentCsvExtractionRunRecordRepository.findOne({
      where: { id: runningRecord.id },
    })
    expect(persistedRecord?.status).toBe("cancelled")

    await expectActivityCreated("agentCsvExtractionRun.cancel")
  })

  it("returns 422 when the run is already completed", async () => {
    await createContext({ status: "completed" })

    expectResponse(await subject(), 422)

    const persisted = await repositories.agentCsvExtractionRunRepository.findOne({
      where: { id: agentCsvExtractionRunId },
    })
    expect(persisted?.status).toBe("completed")
  })

  it("returns 404 for a non-existent run", async () => {
    await createContext()
    agentCsvExtractionRunId = "00000000-0000-0000-0000-000000000000"

    expectResponse(await subject(), 404)
  })
})
