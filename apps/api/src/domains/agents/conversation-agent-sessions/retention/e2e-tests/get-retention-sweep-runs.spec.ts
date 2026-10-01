import { ProjectsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { ConversationAgentSessionsModule } from "../../conversation-agent-sessions.module"

describe("Retention - getRetentionSweepRuns", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ConversationAgentSessionsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!
    return { organization, project }
  }

  const subject = async () =>
    request({
      route: ProjectsRoutes.getRetentionSweepRuns,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  const seedRun = async (overrides: {
    projectId: string
    ranAt: Date
    purgedCount?: number
    status?: "OK" | "PARTIAL" | "ERROR"
    report?: string
  }) =>
    repositories.conversationRetentionSweepRunRepository.save(
      repositories.conversationRetentionSweepRunRepository.create({
        purgedCount: 0,
        status: "OK",
        report: "- Conversations purged: 0\n- Embed sessions purged: 0",
        ...overrides,
      }),
    )

  it("lists the runs of the project, most recent first, with the next run time", async () => {
    await createContext()
    await seedRun({ projectId, ranAt: new Date("2026-08-26T04:00:00Z"), purgedCount: 2 })
    await seedRun({
      projectId,
      ranAt: new Date("2026-08-27T04:00:00Z"),
      status: "PARTIAL",
      report: "- Purge failures: 1 (retried on the next run)",
    })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.runs).toHaveLength(2)
    expect(response.body.data.runs[0]?.status).toBe("PARTIAL")
    expect(response.body.data.runs[0]?.report).toContain("failures")
    expect(response.body.data.runs[1]?.purgedCount).toBe(2)
    expect(response.body.data.nextRunAt).toBeGreaterThan(Date.now())
  })

  it("does not return the runs of another project", async () => {
    await createContext()
    await seedRun({ projectId: crypto.randomUUID(), ranAt: new Date() })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.runs).toHaveLength(0)
  })

  it("rejects a request without a token", async () => {
    await createContext()
    accessToken = undefined

    const response = await subject()

    expectResponse(response, 401)
  })
})
