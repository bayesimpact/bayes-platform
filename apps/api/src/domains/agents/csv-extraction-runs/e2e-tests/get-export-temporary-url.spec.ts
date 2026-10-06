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
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentCsvExtractionRunsModule } from "../agent-csv-extraction-runs.module"
import {
  attachCsvExtractionRunExport,
  createCsvExtractionRun,
  createCsvExtractionRunContext,
} from "./csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "./setup"

describe("AgentCsvExtractionRuns - getExportTemporaryUrl", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

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
      additionalImports: [AgentCsvExtractionRunsModule],
      applyOverrides: (moduleBuilder) =>
        applyCsvExtractionRunOverrides(moduleBuilder, () => authSubject, {
          batchService: mockBatchService,
          fileStorageService: mockFileStorageService,
        }),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
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

  const createContext = async ({ withExport = true }: { withExport?: boolean } = {}) => {
    const context = await createCsvExtractionRunContext({ repositories, authSubject })
    const run = await createCsvExtractionRun({ repositories, context, status: "completed" })
    if (withExport) await attachCsvExtractionRunExport({ repositories, context, run })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    agentCsvExtractionRunId = run.id
    authSubject = context.user.authSubject!
  }

  const subject = async () =>
    request({
      route: AgentCsvExtractionRunsRoutes.live.getExportTemporaryUrl,
      pathParams: removeNullish({ organizationId, projectId, agentId, agentCsvExtractionRunId }),
      token: accessToken,
    })

  it("returns a temporary URL for the run's results export", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.url).toBe("https://example.com/file.csv")
    expect(mockFileStorageService.getTemporaryUrl).toHaveBeenCalledWith("documents/export.csv")
  })

  it("returns 404 while the run has no export", async () => {
    await createContext({ withExport: false })
    expectResponse(await subject(), 404)
  })
})
