import { randomUUID } from "node:crypto"
import { DeskCsvExtractionsRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import {
  attachCsvExtractionRunExport,
  createCsvExtractionRun,
  createCsvExtractionRunContext,
} from "@/domains/agents/csv-extraction-runs/e2e-tests/csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "@/domains/agents/csv-extraction-runs/e2e-tests/setup"
import { userFactory } from "@/domains/users/user.factory"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk CSV extractions - getOne", () => {
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

  const createContext = async () => {
    const context = await createCsvExtractionRunContext({ repositories, authSubject })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    authSubject = context.user.authSubject!
    return context
  }

  const subject = async () =>
    request({
      route: DeskCsvExtractionsRoutes.getOne,
      pathParams: { organizationId, projectId, agentId, agentCsvExtractionRunId },
      token: "token",
    })

  it("returns the run", async () => {
    const context = await createContext()
    const run = await createCsvExtractionRun({ repositories, context, status: "pending" })
    agentCsvExtractionRunId = run.id

    const response = await subject()

    expectSchemaResponse(DeskCsvExtractionsRoutes.getOne, response)
    expect(response.body.data).toEqual({
      id: run.id,
      csvDocumentId: context.csvDocument.id,
      columnSchema: run.columnSchema,
      status: "pending",
      summary: null,
      csvExportDocumentId: null,
      createdAt: run.createdAt.getTime(),
      updatedAt: run.updatedAt.getTime(),
    })
  })

  it("returns an ended run with its summary and its export", async () => {
    const context = await createContext()
    const run = await createCsvExtractionRun({ repositories, context, status: "completed" })
    const summary = { total: 3, processed: 3, errors: 1, running: 0 }
    await repositories.agentCsvExtractionRunRepository.update(run.id, { summary })
    const exportDocument = await attachCsvExtractionRunExport({ repositories, context, run })
    agentCsvExtractionRunId = run.id

    const response = await subject()

    expectSchemaResponse(DeskCsvExtractionsRoutes.getOne, response)
    expect(response.body.data).toMatchObject({
      status: "completed",
      summary,
      csvExportDocumentId: exportDocument.id,
    })
  })

  it("returns 404 for a non-existent run", async () => {
    await createContext()
    agentCsvExtractionRunId = randomUUID()

    expectResponse(await subject(), 404)
  })

  it("answers 404 for a colleague's run", async () => {
    const context = await createContext()
    const colleague = await repositories.userRepository.save(userFactory.build())
    const run = await createCsvExtractionRun({ repositories, context, user: colleague })
    agentCsvExtractionRunId = run.id

    expectResponse(await subject(), 404)
  })

  it("answers 404 for a playground run", async () => {
    const context = await createContext()
    const run = await createCsvExtractionRun({ repositories, context, type: "playground" })
    agentCsvExtractionRunId = run.id

    expectResponse(await subject(), 404)
  })
})
