import { DeskAgentSessionsRoutes } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import {
  createCsvExtractionRun,
  createCsvExtractionRunContext,
  createOtherAgentInProject,
} from "@/domains/agents/csv-extraction-runs/e2e-tests/csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "@/domains/agents/csv-extraction-runs/e2e-tests/setup"
import { userFactory } from "@/domains/users/user.factory"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk CSV extractions - getCsvExtractionRuns", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
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

  const subject = async () => {
    const response = await request({
      route: DeskAgentSessionsRoutes.getCsvExtractionRuns,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
    })
    expectSchemaResponse(DeskAgentSessionsRoutes.getCsvExtractionRuns, response)
    return response.body.data.map((run) => run.id)
  }

  it("returns an empty list when the agent has no runs", async () => {
    await createContext()

    expect(await subject()).toEqual([])
  })

  it("returns only the live runs", async () => {
    const context = await createContext()
    const liveRun = await createCsvExtractionRun({ repositories, context, type: "live" })
    await createCsvExtractionRun({ repositories, context, type: "playground" })

    expect(await subject()).toEqual([liveRun.id])
  })

  it("returns only the requesting user's runs", async () => {
    const context = await createContext()
    const myRun = await createCsvExtractionRun({ repositories, context })
    const colleague = await repositories.userRepository.save(userFactory.build())
    await createCsvExtractionRun({ repositories, context, user: colleague })

    expect(await subject()).toEqual([myRun.id])
  })

  it("still lists runs created before ownership was tracked", async () => {
    const context = await createContext()
    const legacyRun = await createCsvExtractionRun({ repositories, context, user: null })

    expect(await subject()).toEqual([legacyRun.id])
  })

  it("returns only the runs of the requested agent, newest first", async () => {
    const context = await createContext()
    const older = await createCsvExtractionRun({ repositories, context, status: "completed" })
    older.createdAt = new Date("2024-01-01T00:00:00Z")
    await repositories.agentCsvExtractionRunRepository.save(older)
    const newer = await createCsvExtractionRun({ repositories, context, status: "pending" })
    newer.createdAt = new Date("2024-06-01T00:00:00Z")
    await repositories.agentCsvExtractionRunRepository.save(newer)

    // A run of another agent of the same project must not leak in.
    const otherAgent = await createOtherAgentInProject({ repositories, context })
    await createCsvExtractionRun({
      repositories,
      context: { ...context, ...otherAgent },
    })

    expect(await subject()).toEqual([newer.id, older.id])
  })
})
