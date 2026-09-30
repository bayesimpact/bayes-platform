import type { ProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
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
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
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
  let authSubject = "oidc|123"

  const mockBatchService = buildMockBatchService()
  const mockFileStorageService = buildMockFileStorageService()

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [AgentCsvExtractionRunsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) =>
        applyCsvExtractionRunOverrides(moduleBuilder, () => authSubject, {
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
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
    await app.close()
  })

  let context: Awaited<ReturnType<typeof createCsvExtractionRunContext>>

  const createContext = async (role: ProjectMembershipRoleDto = "owner") => {
    context = await createCsvExtractionRunContext({ repositories, authSubject, role })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    csvDocumentId = context.csvDocument.id
    authSubject = context.user.authSubject!
  }

  const seedRevision = async ({
    revision,
    isDraft = false,
    isArchived = false,
  }: {
    revision: number
    isDraft?: boolean
    isArchived?: boolean
  }) => {
    const settings = agentSettingsFactory
      .transient({
        organization: context.organization,
        project: context.project,
        agent: context.agent,
      })
      .build({ revision, isDraft, isArchived })
    await repositories.agentSettingsRepository.save(settings)
    return settings
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

  const subject = async (agentSettingsRevision?: number, type: "live" | "playground" = "live") =>
    request({
      route: AgentCsvExtractionRunsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: { payload: { csvDocumentId, columnSchema, type, agentSettingsRevision } },
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
    expect(response.body.data.type).toBe("live")
    expect(response.body.data.summary).toBeNull()
    expect(response.body.data.csvExportDocumentId).toBeNull()

    const persisted = await repositories.agentCsvExtractionRunRepository.findOne({
      where: { id: response.body.data.id },
    })
    expect(persisted).not.toBeNull()
    expect(persisted?.status).toBe("pending")

    await expectActivityCreated("agentCsvExtractionRun.create")
  })

  it("stores the creator on the run", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 201)
    const persisted = await repositories.agentCsvExtractionRunRepository.findOne({
      where: { id: response.body.data.id },
    })
    expect(persisted?.userId).toBe(context.user.id)
  })

  it("stores the requested type on the run", async () => {
    await createContext()

    const response = await subject(undefined, "playground")

    expectResponse(response, 201)
    expect(response.body.data.type).toBe("playground")

    const persisted = await repositories.agentCsvExtractionRunRepository.findOne({
      where: { id: response.body.data.id },
    })
    expect(persisted?.type).toBe("playground")
  })

  it("rejects a payload that does not name a type", async () => {
    await createContext()

    const response = await request({
      route: AgentCsvExtractionRunsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: {
        payload: { csvDocumentId, columnSchema },
      } as unknown as typeof AgentCsvExtractionRunsRoutes.createOne.request,
    })

    expectResponse(response, 403)
  })

  it("rejects an unknown type", async () => {
    await createContext()

    const response = await request({
      route: AgentCsvExtractionRunsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: {
        payload: { csvDocumentId, columnSchema, type: "all" },
      } as unknown as typeof AgentCsvExtractionRunsRoutes.createOne.request,
    })

    expectResponse(response, 403)
  })

  it("pins the run to the draft when an admin asks for its revision", async () => {
    await createContext("admin")
    const draft = await seedRevision({ revision: 2, isDraft: true })

    const response = await subject(2)

    expectResponse(response, 201)
    expect(response.body.data.agentSettingsId).toBe(draft.id)
    expect(response.body.data.agentRevision).toBe(2)
  })

  it("pins the run to the published version when no revision is asked for", async () => {
    await createContext()
    await seedRevision({ revision: 2, isDraft: true })

    const response = await subject()

    expectResponse(response, 201)
    expect(response.body.data.agentSettingsId).toBe(context.agentSettings.id)
    expect(response.body.data.agentRevision).toBe(context.agentSettings.revision)
  })

  it("returns 403 when a plain member asks for a revision", async () => {
    // Only the roles that can list the versions may choose one. A member creating a run keeps
    // getting the published version.
    await createContext("member")
    await seedRevision({ revision: 2, isDraft: true })

    expectResponse(await subject(2), 403)
  })

  it("lets a plain member create a run when asking for no revision", async () => {
    // Positive control for the case above: `AgentCsvExtractionRunPolicy.canCreate()` is only
    // `canAccess()`, so a plain member can create a run as long as they don't choose a version.
    // Without this, a policy change that quietly blocked members here would go unnoticed while
    // the 403 test above kept passing.
    await createContext("member")

    const response = await subject()

    expectResponse(response, 201)
    expect(response.body.data.agentSettingsId).toBe(context.agentSettings.id)
  })

  it("rejects a revision outside the Postgres integer range", async () => {
    // `agent_settings.revision` is a Postgres `integer`; anything past its 32-bit signed range
    // must be turned away here rather than surface as a driver range error.
    await createContext()

    expectResponse(await subject(9999999999), 403)
  })

  it("returns 404 for a revision the agent does not have", async () => {
    await createContext()

    expectResponse(await subject(9), 404)
  })

  it("returns 422 for an archived revision", async () => {
    await createContext()
    await seedRevision({ revision: 2, isArchived: true })

    expectResponse(await subject(2), 422)
  })

  it("rejects a revision that is not an integer", async () => {
    await createContext()

    const response = await request({
      route: AgentCsvExtractionRunsRoutes.createOne,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
      request: {
        payload: { csvDocumentId, columnSchema, agentSettingsRevision: "2" },
      } as unknown as typeof AgentCsvExtractionRunsRoutes.createOne.request,
    })

    expectResponse(response, 403)
  })
})
