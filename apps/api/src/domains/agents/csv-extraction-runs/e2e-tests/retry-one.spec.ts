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
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { agentCsvExtractionRunRecordFactory } from "../agent-csv-extraction-run-record.factory"
import { AgentCsvExtractionRunsModule } from "../agent-csv-extraction-runs.module"
import { createCsvExtractionRun, createCsvExtractionRunContext } from "./csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "./setup"

describe("AgentCsvExtractionRuns - retryOne", () => {
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
  let authSubject = "oidc|123"

  const mockBatchService = buildMockBatchService()
  const mockFileStorageService = buildMockFileStorageService()

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [AgentCsvExtractionRunsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        applyCsvExtractionRunOverrides(moduleBuilder, () => authSubject, {
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
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  let context: Awaited<ReturnType<typeof createCsvExtractionRunContext>>

  const createContext = async () => {
    context = await createCsvExtractionRunContext({ repositories, authSubject })
    const run = await createCsvExtractionRun({ repositories, context, status: "failed" })

    const erroredRecord = agentCsvExtractionRunRecordFactory
      .transient({
        organization: context.organization,
        project: context.project,
        agentCsvExtractionRun: run,
      })
      .build({ status: "error", rowIndex: 0, errorDetails: "boom" })
    await repositories.agentCsvExtractionRunRecordRepository.save(erroredRecord)

    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    agentCsvExtractionRunId = run.id
    authSubject = context.user.authSubject!
  }

  const subject = async () =>
    request({
      route: AgentCsvExtractionRunsRoutes.retryOne,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
      token: accessToken,
    })

  it("re-enqueues unfinished records and marks the run running", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 201)
    expect(response.body.data.id).toBe(agentCsvExtractionRunId)
    expect(mockBatchService.retryRunRecords).toHaveBeenCalledTimes(1)

    const persisted = await repositories.agentCsvExtractionRunRepository.findOne({
      where: { id: agentCsvExtractionRunId },
    })
    expect(persisted?.status).toBe("running")

    await expectActivityCreated("agentCsvExtractionRun.retry")
  })

  it("returns 404 for a non-existent run", async () => {
    await createContext()
    agentCsvExtractionRunId = "00000000-0000-0000-0000-000000000000"

    expectResponse(await subject(), 404)
    expect(mockBatchService.retryRunRecords).not.toHaveBeenCalled()
  })

  it("re-enqueues against the version the run was pinned to, not the newest published one", async () => {
    // Otherwise retrying a run started on an older or draft version silently promotes it to the
    // latest published version, and the run's own revision badge stops being true.
    await createContext()
    const newer = agentSettingsFactory
      .transient({
        organization: context.organization,
        project: context.project,
        agent: context.agent,
      })
      .build({ revision: 2 })
    await repositories.agentSettingsRepository.save(newer)

    expectResponse(await subject(), 201)

    expect(mockBatchService.retryRunRecords).toHaveBeenCalledTimes(1)
    const [payloads] = mockBatchService.retryRunRecords.mock.calls[0]
    expect(payloads[0].agentWithSettings.settings.revision).toBe(context.agentSettings.revision)
  })
})
