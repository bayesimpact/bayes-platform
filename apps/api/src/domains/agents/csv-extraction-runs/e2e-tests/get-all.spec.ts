import {
  AgentCsvExtractionRunsRoutes,
  type BaseAgentSessionTypeDto,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { clearTestDatabase } from "@/common/test/test-database"
import {
  type AllRepositories,
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { userFactory } from "@/domains/users/user.factory"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { agentCsvExtractionRunFactory } from "../agent-csv-extraction-run.factory"
import { AgentCsvExtractionRunsModule } from "../agent-csv-extraction-runs.module"
import { createCsvExtractionRun, createCsvExtractionRunContext } from "./csv-extraction-run.helpers"
import {
  applyCsvExtractionRunOverrides,
  buildMockBatchService,
  buildMockFileStorageService,
} from "./setup"

describe("AgentCsvExtractionRuns - getAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let agentId: string
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

  const subject = async (type: BaseAgentSessionTypeDto = "live") =>
    request({
      route: AgentCsvExtractionRunsRoutes[type].getAll,
      pathParams: removeNullish({ organizationId, projectId, agentId }),
      token: accessToken,
    })

  it("returns an empty list when the agent has no runs", async () => {
    const context = await createCsvExtractionRunContext({ repositories, authSubject })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    authSubject = context.user.authSubject!

    const response = await subject("live")

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })

  it("returns only the runs of the route's type", async () => {
    // The Desk app lists live runs and the Studio playground its own: one surface's runs must
    // never leak into the other.
    const context = await createCsvExtractionRunContext({ repositories, authSubject })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    authSubject = context.user.authSubject!

    const liveRun = await createCsvExtractionRun({ repositories, context, type: "live" })
    const playgroundRun = await createCsvExtractionRun({
      repositories,
      context,
      type: "playground",
    })

    const liveResponse = await subject("live")
    expectResponse(liveResponse, 200)
    expect(liveResponse.body.data.map((run) => run.id)).toEqual([liveRun.id])
    expect(liveResponse.body.data[0]?.type).toBe("live")

    const playgroundResponse = await subject("playground")
    expectResponse(playgroundResponse, 200)
    expect(playgroundResponse.body.data.map((run) => run.id)).toEqual([playgroundRun.id])
    expect(playgroundResponse.body.data[0]?.type).toBe("playground")
  })

  it("returns only the requesting user's runs", async () => {
    // Extraction lists are per-user, exactly like extraction agent sessions: one member's runs
    // must not show up in a colleague's Desk app.
    const context = await createCsvExtractionRunContext({ repositories, authSubject })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    authSubject = context.user.authSubject!

    const myRun = await createCsvExtractionRun({ repositories, context })
    const colleague = userFactory.build()
    await repositories.userRepository.save(colleague)
    await createCsvExtractionRun({ repositories, context, user: colleague })

    const response = await subject("live")

    expectResponse(response, 200)
    expect(response.body.data.map((run) => run.id)).toEqual([myRun.id])
  })

  it("still lists runs created before ownership was tracked", async () => {
    // Rows predating the user_id column have no creator; they stay visible to every member
    // rather than vanishing from all lists.
    const context = await createCsvExtractionRunContext({ repositories, authSubject })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    authSubject = context.user.authSubject!

    const legacyRun = await createCsvExtractionRun({ repositories, context, user: null })

    const response = await subject("live")

    expectResponse(response, 200)
    expect(response.body.data.map((run) => run.id)).toEqual([legacyRun.id])
  })

  it("returns only the runs belonging to the requested agent, newest first", async () => {
    const context = await createCsvExtractionRunContext({ repositories, authSubject })
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    authSubject = context.user.authSubject!

    const older = await createCsvExtractionRun({ repositories, context, status: "completed" })
    older.createdAt = new Date("2024-01-01T00:00:00Z")
    await repositories.agentCsvExtractionRunRepository.save(older)

    const newer = await createCsvExtractionRun({ repositories, context, status: "pending" })
    newer.createdAt = new Date("2024-06-01T00:00:00Z")
    await repositories.agentCsvExtractionRunRepository.save(newer)

    // A run on a different agent in the same project must not leak in.
    const otherAgent = agentFactory
      .transient({ organization: context.organization, project: context.project })
      .build({ type: "extraction" })
    await repositories.agentRepository.save(otherAgent)
    const otherAgentSettings = agentSettingsFactory
      .transient({
        organization: context.organization,
        project: context.project,
        agent: otherAgent,
      })
      .build()
    await repositories.agentSettingsRepository.save(otherAgentSettings)
    const otherRun = agentCsvExtractionRunFactory
      .transient({
        organization: context.organization,
        project: context.project,
        agent: otherAgent,
        agentSettings: otherAgentSettings,
        csvDocument: context.csvDocument,
      })
      .build()
    await repositories.agentCsvExtractionRunRepository.save(otherRun)

    const response = await subject("live")

    expectResponse(response, 200)
    expect(response.body.data.map((run) => run.id)).toEqual([newer.id, older.id])
  })
})
