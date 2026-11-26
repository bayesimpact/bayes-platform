import { randomUUID } from "node:crypto"
import { DeskCsvExtractionsRoutes } from "@bayes-platform/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
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

describe("Desk CSV extractions - getRecords", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

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

  const createContext = async ({ recordCount = 0 }: { recordCount?: number } = {}) => {
    const context = await createCsvExtractionRunContext({ repositories, authSubject })
    const run = await createCsvExtractionRun({
      repositories,
      context,
      status: "completed",
      type: "live",
    })
    const buildRecord = agentCsvExtractionRunRecordFactory.transient({
      organization: context.organization,
      project: context.project,
      agentCsvExtractionRun: run,
    })
    for (let rowIndex = 0; rowIndex < recordCount; rowIndex++) {
      await repositories.agentCsvExtractionRunRecordRepository.save(
        buildRecord.build({ rowIndex, inputData: { name: `Row ${rowIndex}` } }),
      )
    }
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    agentCsvExtractionRunId = run.id
    authSubject = context.user.authSubject!
    return { buildRecord }
  }

  const subject = async (query: Record<string, string> = { page: "0", limit: "10" }) =>
    request({
      route: DeskCsvExtractionsRoutes.getRecords,
      pathParams: { organizationId, projectId, agentId, agentCsvExtractionRunId },
      token: "token",
      query,
    })

  it("returns paginated records ordered by rowIndex", async () => {
    await createContext({ recordCount: 3 })

    const response = await subject()

    expectSchemaResponse(DeskCsvExtractionsRoutes.getRecords, response)
    expect(response.body.data).toMatchObject({ total: 3, page: 0, limit: 10 })
    expect(response.body.data.records.map((record) => record.rowIndex)).toEqual([0, 1, 2])
  })

  it("honours the page and limit query params", async () => {
    await createContext({ recordCount: 3 })

    const response = await subject({ page: "1", limit: "2" })

    expectSchemaResponse(DeskCsvExtractionsRoutes.getRecords, response)
    expect(response.body.data).toMatchObject({ total: 3, page: 1, limit: 2 })
    expect(response.body.data.records.map((record) => record.rowIndex)).toEqual([2])
  })

  it("passes the sort to the service", async () => {
    await createContext({ recordCount: 3 })

    const response = await subject({
      page: "0",
      limit: "10",
      sortBy: "rowIndex",
      sortOrder: "desc",
    })

    expectSchemaResponse(DeskCsvExtractionsRoutes.getRecords, response)
    expect(response.body.data.records.map((record) => record.rowIndex)).toEqual([2, 1, 0])
  })

  it("returns an empty page when the run has no records", async () => {
    await createContext({ recordCount: 0 })

    const response = await subject()

    expectSchemaResponse(DeskCsvExtractionsRoutes.getRecords, response)
    expect(response.body.data).toEqual({ records: [], total: 0, page: 0, limit: 10 })
  })

  it("returns a record with an error", async () => {
    const { buildRecord } = await createContext()
    const record = await repositories.agentCsvExtractionRunRecordRepository.save(
      buildRecord.build({
        rowIndex: 0,
        status: "error",
        inputData: { "col-name": "Alice" },
        agentRawOutput: { fullName: null },
        errorDetails: "The agent answered no JSON",
        traceId: "trace-1",
      }),
    )

    const response = await subject()

    expectSchemaResponse(DeskCsvExtractionsRoutes.getRecords, response)
    expect(response.body.data.records).toEqual([
      {
        id: record.id,
        rowIndex: 0,
        status: "error",
        inputData: { "col-name": "Alice" },
        agentRawOutput: { fullName: null },
        errorDetails: "The agent answered no JSON",
      },
    ])
  })

  it("answers 400 when limit is over 100", async () => {
    await createContext({ recordCount: 1 })

    expectResponse(await subject({ page: "0", limit: "101" }), 400)
  })

  it("answers 400 when limit is 0", async () => {
    await createContext({ recordCount: 1 })

    expectResponse(await subject({ page: "0", limit: "0" }), 400)
  })

  it("answers 400 when limit is empty", async () => {
    await createContext({ recordCount: 1 })

    expectResponse(await subject({ page: "0", limit: "" }), 400)
  })

  it("answers 400 when page is empty", async () => {
    await createContext({ recordCount: 1 })

    expectResponse(await subject({ page: "", limit: "10" }), 400)
  })

  it("sorts by row when sortBy names no sortable field", async () => {
    await createContext({ recordCount: 3 })

    const response = await subject({
      page: "0",
      limit: "10",
      sortBy: "unknownField",
      sortOrder: "desc",
    })

    expectSchemaResponse(DeskCsvExtractionsRoutes.getRecords, response)
    expect(response.body.data.records.map((record) => record.rowIndex)).toEqual([0, 1, 2])
  })

  it("answers 400 without page and limit", async () => {
    // The live route falls back to page 0 and 10 rows; the Desk schema requires both.
    await createContext({ recordCount: 1 })

    expectResponse(await subject({}), 400)
  })

  it("returns 404 for a non-existent run", async () => {
    await createContext()
    agentCsvExtractionRunId = randomUUID()

    expectResponse(await subject(), 404)
  })
})
