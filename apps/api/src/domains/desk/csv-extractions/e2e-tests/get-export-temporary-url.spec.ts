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
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk CSV extractions - getExportTemporaryUrl", () => {
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

  const createContext = async ({ withExport = true }: { withExport?: boolean } = {}) => {
    const context = await createCsvExtractionRunContext({ repositories, authSubject })
    const run = await createCsvExtractionRun({
      repositories,
      context,
      status: "completed",
      type: "live",
    })
    if (withExport) await attachCsvExtractionRunExport({ repositories, context, run })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    agentCsvExtractionRunId = run.id
    authSubject = context.user.authSubject!
  }

  const subject = async () =>
    request({
      route: DeskCsvExtractionsRoutes.getExportTemporaryUrl,
      pathParams: { organizationId, projectId, agentId, agentCsvExtractionRunId },
      token: "token",
    })

  it("returns a temporary URL for the run's results export", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(DeskCsvExtractionsRoutes.getExportTemporaryUrl, response)
    expect(response.body.data.url).toBe("https://example.com/file.csv")
    expect(mockFileStorageService.getTemporaryUrl).toHaveBeenCalledWith("documents/export.csv")
  })

  it("returns 404 while the run has no export", async () => {
    await createContext({ withExport: false })

    expectResponse(await subject(), 404)
    expect(mockFileStorageService.getTemporaryUrl).not.toHaveBeenCalled()
  })
})
