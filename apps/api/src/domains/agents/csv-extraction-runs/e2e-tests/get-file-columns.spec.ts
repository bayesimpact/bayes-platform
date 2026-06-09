import { randomUUID } from "node:crypto"
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
import { AgentCsvExtractionRunsModule } from "../agent-csv-extraction-runs.module"
import { createCsvExtractionRunContext } from "./csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "./setup"

describe("AgentCsvExtractionRuns - getFileColumns", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
  let documentId: string
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

  const createContext = async () => {
    const context = await createCsvExtractionRunContext({ repositories, auth0Id })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    documentId = context.csvDocument.id
    auth0Id = context.user.auth0Id
  }

  const subject = async () =>
    request({
      route: AgentCsvExtractionRunsRoutes.getFileColumns,
      pathParams: removeNullish({ organizationId, projectId, agentId, documentId }),
      token: accessToken,
    })

  it("parses and returns the CSV columns with preview values", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.map((column) => column.name)).toEqual(["name", "age"])
    expect(response.body.data[0]?.values).toEqual(["Alice", "Bob"])
    expect(response.body.data[1]?.values).toEqual(["30", "40"])
    expect(mockFileStorageService.createReadStream).toHaveBeenCalledTimes(1)
  })

  it("returns 404 when the document does not exist", async () => {
    await createContext()
    documentId = randomUUID()

    expectResponse(await subject(), 404)
    expect(mockFileStorageService.createReadStream).not.toHaveBeenCalled()
  })
})
