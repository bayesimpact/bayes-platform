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
import { AgentCsvExtractionRunsModule } from "../agent-csv-extraction-runs.module"
import { createCsvExtractionRunContext } from "./csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "./setup"

describe("AgentCsvExtractionRuns - createOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let agentId: string
  let csvDocumentId: string
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
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    csvDocumentId = context.csvDocument.id
    auth0Id = context.user.auth0Id
  }

  const columnSchema = {
    "col-name": {
      id: "col-name",
      originalName: "name",
      finalName: "name",
      role: "input",
      index: 0,
    },
  } as const

  const subject = async () =>
    request({
      route: AgentCsvExtractionRunsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: { payload: { csvDocumentId, columnSchema } },
    })

  it("creates a pending run and persists it", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 201)
    expect(response.body.data.id).toBeDefined()
    expect(response.body.data.status).toBe("pending")
    expect(response.body.data.csvDocumentId).toBe(csvDocumentId)
    expect(response.body.data.agentId).toBe(agentId)
    expect(response.body.data.columnSchema).toEqual(columnSchema)
    expect(response.body.data.summary).toBeNull()
    expect(response.body.data.csvExportDocumentId).toBeNull()

    const persisted = await repositories.agentCsvExtractionRunRepository.findOne({
      where: { id: response.body.data.id },
    })
    expect(persisted).not.toBeNull()
    expect(persisted?.status).toBe("pending")

    await expectActivityCreated("agentCsvExtractionRun.create")
  })
})
