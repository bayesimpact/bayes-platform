import { randomUUID } from "node:crypto"
import { BackofficeRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import type { Agent } from "@/domains/agents/agent.entity"
import { grantConversationReview } from "@/domains/agents/conversation-reviewers/agent-conversation-reviewer.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import type { User } from "@/domains/users/user.entity"
import { userFactory } from "@/domains/users/user.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformStaffToUser,
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - agent conversation reviewers", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [BackofficeModule, RbacModule, ActivitiesModule],
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
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** An agent, a person to grant, and the caller with the given global role. */
  const createContext = async (assignRole: typeof assignPlatformSuperadminToUser) => {
    const { user: caller, agent } = await createOrganizationWithAgent(repositories, {
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    await assignRole({ repositories, user: caller })
    const reviewer = userFactory.build({ email: "reviewer@example.com" })
    await repositories.userRepository.save(reviewer)
    return { caller, agent, reviewer }
  }

  const grant = (agentId: string, email: string) =>
    request({
      route: BackofficeRoutes.grantAgentConversationReviewer,
      pathParams: { agentId },
      request: { payload: { email } },
      token: "token",
    })

  const revoke = (agentId: string, userId: string) =>
    request({
      route: BackofficeRoutes.revokeAgentConversationReviewer,
      pathParams: { agentId, userId },
      token: "token",
    })

  const getAgent = (agentId: string) =>
    request({ route: BackofficeRoutes.getAgent, pathParams: { agentId }, token: "token" })

  const reviewerRows = (agent: Agent, user: User) =>
    repositories.userMembershipRepository.findBy({
      resourceType: "temp_agent",
      resourceId: agent.id,
      userId: user.id,
    })

  it("lets a superadmin grant the review of one agent by email, then revoke it", async () => {
    const { agent, reviewer } = await createContext(assignPlatformSuperadminToUser)

    expectResponse(await grant(agent.id, "Reviewer@Example.com"), 201)
    expect(await reviewerRows(agent, reviewer)).toHaveLength(1)

    const detail = await getAgent(agent.id)
    expectResponse(detail, 200)
    expect(detail.body.data.conversationReviewers).toEqual([
      {
        userId: reviewer.id,
        email: reviewer.email,
        name: reviewer.name,
        grantedAt: expect.any(Number),
      },
    ])

    expectResponse(await revoke(agent.id, reviewer.id), 200)
    expect(await reviewerRows(agent, reviewer)).toEqual([])
  })

  it("is idempotent when the person already reviews the agent", async () => {
    const { agent, reviewer } = await createContext(assignPlatformSuperadminToUser)
    await grantConversationReview({ repositories, user: reviewer, agent })

    expectResponse(await grant(agent.id, reviewer.email), 201)
    expect(await reviewerRows(agent, reviewer)).toHaveLength(1)
  })

  it("returns 404 for an email no account has", async () => {
    const { agent } = await createContext(assignPlatformSuperadminToUser)
    expectResponse(await grant(agent.id, "nobody@example.com"), 404)
  })

  it("returns 404 for an unknown agent", async () => {
    const { reviewer } = await createContext(assignPlatformSuperadminToUser)
    expectResponse(await grant(randomUUID(), reviewer.email), 404)
  })

  it("returns 400 for a malformed email", async () => {
    const { agent } = await createContext(assignPlatformSuperadminToUser)
    expectResponse(await grant(agent.id, "not-an-email"), 400)
  })

  it("records the grant in the activity log against the agent", async () => {
    const { agent, reviewer } = await createContext(assignPlatformSuperadminToUser)

    expectResponse(await grant(agent.id, reviewer.email), 201)

    const activities = await setup.dataSource.query(
      `SELECT action, entity_id AS "entityId", entity_type AS "entityType" FROM activity`,
    )
    expect(activities).toEqual([
      {
        action: "backoffice.agent.conversation_reviewer.grant",
        entityId: agent.id,
        entityType: "agent",
      },
    ])
  })

  it("rejects platform staff, who cannot grant the review", async () => {
    const { agent, reviewer } = await createContext(assignPlatformStaffToUser)

    expectResponse(await grant(agent.id, reviewer.email), 403)
    expectResponse(await revoke(agent.id, reviewer.id), 403)
    expect(await reviewerRows(agent, reviewer)).toEqual([])
  })
})
