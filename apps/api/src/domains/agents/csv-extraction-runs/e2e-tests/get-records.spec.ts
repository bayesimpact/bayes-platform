import { AgentCsvExtractionRunsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { agentCsvExtractionRunRecordFactory } from "../agent-csv-extraction-run-record.factory"
import { AgentCsvExtractionRunsModule } from "../agent-csv-extraction-runs.module"
import { createCsvExtractionRun, createCsvExtractionRunContext } from "./csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "./setup"

describe("AgentCsvExtractionRuns - getRecords", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

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
      additionalImports: [AgentCsvExtractionRunsModule],
      applyOverrides: (moduleBuilder) =>
        applyCsvExtractionRunOverrides(moduleBuilder, () => auth0Id, {
          batchService: mockBatchService,
          fileStorageService: mockFileStorageService,
        }),
    })
    repositories = setup.getAllRepositories()
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

  const createContext = async ({ recordCount = 0 }: { recordCount?: number } = {}) => {
    const context = await createCsvExtractionRunContext({ repositories, auth0Id })
    const run = await createCsvExtractionRun({ repositories, context, status: "completed" })

    for (let rowIndex = 0; rowIndex < recordCount; rowIndex++) {
      const record = agentCsvExtractionRunRecordFactory
        .transient({
          organization: context.organization,
          project: context.project,
          agentCsvExtractionRun: run,
        })
        .build({ rowIndex, inputData: { name: `Row ${rowIndex}` } })
      await repositories.agentCsvExtractionRunRecordRepository.save(record)
    }

    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    agentCsvExtractionRunId = run.id
    auth0Id = context.user.auth0Id
  }

  const subject = async (query?: Record<string, string>) =>
    request({
      route: AgentCsvExtractionRunsRoutes.getRecords,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
      token: accessToken,
      query,
    })

  it("returns paginated records ordered by rowIndex", async () => {
    await createContext({ recordCount: 3 })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.total).toBe(3)
    expect(response.body.data.page).toBe(0)
    expect(response.body.data.limit).toBe(10)
    expect(response.body.data.records.map((record) => record.rowIndex)).toEqual([0, 1, 2])
  })

  it("honours the page and limit query params", async () => {
    await createContext({ recordCount: 3 })

    const response = await subject({ page: "1", limit: "2" })

    expectResponse(response, 200)
    expect(response.body.data.total).toBe(3)
    expect(response.body.data.page).toBe(1)
    expect(response.body.data.limit).toBe(2)
    expect(response.body.data.records).toHaveLength(1)
    expect(response.body.data.records[0]?.rowIndex).toBe(2)
  })

  it("returns an empty page when the run has no records", async () => {
    await createContext({ recordCount: 0 })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.total).toBe(0)
    expect(response.body.data.records).toEqual([])
  })

  it("returns 404 for a non-existent run", async () => {
    await createContext()
    agentCsvExtractionRunId = "00000000-0000-0000-0000-000000000000"

    expectResponse(await subject(), 404)
  })
})
