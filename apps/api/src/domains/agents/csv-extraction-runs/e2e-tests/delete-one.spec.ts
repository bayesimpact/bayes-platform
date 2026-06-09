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

describe("AgentCsvExtractionRuns - deleteOne", () => {
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

  const createContext = async () => {
    const context = await createCsvExtractionRunContext({ repositories, auth0Id })
    const run = await createCsvExtractionRun({ repositories, context, status: "completed" })

    const record = agentCsvExtractionRunRecordFactory
      .transient({
        organization: context.organization,
        project: context.project,
        agentCsvExtractionRun: run,
      })
      .build({ rowIndex: 0 })
    await repositories.agentCsvExtractionRunRecordRepository.save(record)

    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    agentCsvExtractionRunId = run.id
    auth0Id = context.user.auth0Id
  }

  const subject = async () =>
    request({
      route: AgentCsvExtractionRunsRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
      token: accessToken,
    })

  it("deletes the run and its records", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.success).toBe(true)

    const persistedRun = await repositories.agentCsvExtractionRunRepository.findOne({
      where: { id: agentCsvExtractionRunId },
    })
    expect(persistedRun).toBeNull()

    const remainingRecords = await repositories.agentCsvExtractionRunRecordRepository.find({
      where: { agentCsvExtractionRunId },
    })
    expect(remainingRecords).toHaveLength(0)

    await expectActivityCreated("agentCsvExtractionRun.delete")
  })

  it("returns 404 for a non-existent run", async () => {
    await createContext()
    agentCsvExtractionRunId = "00000000-0000-0000-0000-000000000000"

    expectResponse(await subject(), 404)
  })
})
