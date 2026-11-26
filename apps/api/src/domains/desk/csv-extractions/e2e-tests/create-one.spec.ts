import { DeskCsvExtractionsRoutes } from "@bayes-platform/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
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
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../test/request"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../../../test/schema-request"
import { DeskModule } from "../../desk.module"

describe("Desk CSV extractions - createOne", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let organizationId: string
  let projectId: string
  let agentId: string
  let csvDocumentId: string
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
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
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

  let context: Awaited<ReturnType<typeof createCsvExtractionRunContext>>

  const createContext = async (role: ProjectRoleKey = "project_owner") => {
    context = await createCsvExtractionRunContext({ repositories, authSubject, role })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    csvDocumentId = context.csvDocument.id
    authSubject = context.user.authSubject!
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

  const subject = async (payload: Record<string, unknown> = { csvDocumentId, columnSchema }) =>
    request({
      route: DeskCsvExtractionsRoutes.createOne,
      pathParams: { organizationId, projectId, agentId },
      token: "token",
      body: { payload },
    })

  it("creates a pending run and persists it", async () => {
    await createContext()

    const response = await subject()

    expectSchemaResponse(DeskCsvExtractionsRoutes.createOne, response, 201)
    const persisted = await repositories.agentCsvExtractionRunRepository.findOneOrFail({
      where: { id: response.body.data.id },
    })
    expect(response.body.data).toEqual({
      id: persisted.id,
      csvDocumentId,
      columnSchema,
      status: "pending",
      summary: null,
      csvExportDocumentId: null,
      createdAt: persisted.createdAt.getTime(),
      updatedAt: persisted.updatedAt.getTime(),
    })

    await expectActivityCreated("agentCsvExtractionRun.create")
  })

  it("stores the creator and the live type on the run", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 201)
    const persisted = await repositories.agentCsvExtractionRunRepository.findOneOrFail({
      where: { id: response.body.data.id },
    })
    expect(persisted.userId).toBe(context.user.id)
    expect(persisted.type).toBe("live")
  })

  it("pins the run to the version in production", async () => {
    await createContext()
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .transient({
          organization: context.organization,
          project: context.project,
          agent: context.agent,
        })
        .build({ revision: 2, isDraft: true }),
    )

    const response = await subject()

    expectResponse(response, 201)
    const persisted = await repositories.agentCsvExtractionRunRepository.findOneOrFail({
      where: { id: response.body.data.id },
    })
    expect(persisted.agentSettingsId).toBe(context.agentSettings.id)
  })

  it("lets a plain member create a run", async () => {
    await createContext("project_member")

    expectResponse(await subject(), 201)
  })

  it("answers 400 for a settings version in the body", async () => {
    // A live run always runs the version in production: the Desk schema has no field to name
    // another one.
    await createContext()

    expectResponse(await subject({ csvDocumentId, columnSchema, agentSettingsRevision: 2 }), 400)
    expect(await repositories.agentCsvExtractionRunRepository.count()).toBe(0)
  })
})
