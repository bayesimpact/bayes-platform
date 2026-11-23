import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import { DeskCsvExtractionsRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createCsvExtractionRunContext } from "@/domains/agents/csv-extraction-runs/e2e-tests/csv-extraction-run.helpers"
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

describe("Desk CSV extractions - getFileColumns", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let documentId: string
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
    documentId = context.csvDocument.id
    authSubject = context.user.authSubject!
  }

  const subject = async () =>
    request({
      route: DeskCsvExtractionsRoutes.getFileColumns,
      pathParams: { organizationId, projectId, agentId, documentId },
      token: "token",
    })

  it("parses and returns the CSV columns with preview values", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(DeskCsvExtractionsRoutes.getFileColumns, response)
    expect(response.body.data.map((column) => column.name)).toEqual(["name", "age"])
    expect(response.body.data[0]?.values).toEqual(["Alice", "Bob"])
    expect(response.body.data[1]?.values).toEqual(["30", "40"])
    expect(mockFileStorageService.createReadStream).toHaveBeenCalledWith("documents/input.csv")
  })

  it("answers 422 for a CSV with no columns", async () => {
    await createContext()
    mockFileStorageService.createReadStream.mockImplementationOnce(() => Readable.from([""]))

    expectResponse(await subject(), 422, "CSV file has no columns")
  })

  it("returns 404 when the document does not exist", async () => {
    await createContext()
    documentId = randomUUID()

    expectResponse(await subject(), 404)
    expect(mockFileStorageService.createReadStream).not.toHaveBeenCalled()
  })
})
