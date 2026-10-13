import { randomUUID } from "node:crypto"
import {
  AgentSessionMessagesRoutes,
  type BaseAgentSessionTypeDto,
  type ProjectMembershipRoleDto,
} from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { conversationAgentSessionFactory } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.factory"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../../test/rbac-test.helpers"
import { expectResponse } from "../../../../../../../test/request"
import { StreamingModule } from "../streaming.module"

describe("Agent Session Messages - stream - Auth", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  // Variables for the tests
  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let agentId: string | null = randomUUID()
  let agentSessionId: string | null = randomUUID()
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [StreamingModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    organizationId = randomUUID()
    projectId = randomUUID()
    agentId = randomUUID()
    agentSessionId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  // Seeds an organization/project (membership at `role`) + conversation agent, and a session of
  // `type` owned by the caller.
  const createContextForRole = async (
    role: ProjectMembershipRoleDto,
    type: BaseAgentSessionTypeDto = "live",
  ) => {
    const { organization, project, agent, agentSession, user } =
      await createOrganizationWithAgentSession({
        repositories,
        params: {
          user: { authSubject, email: mockOidcEmailForSub(authSubject) },
          projectMembership: { role },
          agentSession: { type },
        },
        agentType: "conversation",
      })

    authSubject = user.authSubject!
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentSessionId = agentSession.id
    accessToken = "token"
    return { organization, project, agent, type }
  }

  /**
   * Switches the caller to an organization admin who holds no role on the project, and points the
   * path at a session of their own, so only the permission check stands between them and the route.
   */
  const switchToOrganizationAdminWithoutProjectRole = async ({
    organization,
    project,
    agent,
    type,
  }: Awaited<ReturnType<typeof createContextForRole>>) => {
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    const { user } = await addUserToOrganization({
      repositories,
      organization,
      user: {
        authSubject: organizationAdminAuthSubject,
        email: mockOidcEmailForSub(organizationAdminAuthSubject),
      },
      membership: { role: "admin" },
    })
    const agentSession = conversationAgentSessionFactory
      .transient({ organization, project, agent, user })
      .build({ type })
    await repositories.conversationAgentSessionRepository.save(agentSession)
    authSubject = organizationAdminAuthSubject
    agentSessionId = agentSession.id
  }

  /** The stream is a GET: its payload travels JSON-encoded in `?q=`. */
  const subject = (type: BaseAgentSessionTypeDto) => {
    const path = AgentSessionMessagesRoutes[type].stream.getPath(
      removeNullish({ organizationId, projectId, agentId, agentSessionId }),
    )
    const req = request(app.getHttpServer())
      .get(path)
      .query({ q: JSON.stringify({ payload: { content: "Hello" } }) })
      .set("Connection", "close")
    if (accessToken) req.set("Authorization", `Bearer ${accessToken}`)
    return req
  }

  const countSessionMessages = () =>
    repositories.agentMessageRepository.count({ where: { sessionId: agentSessionId ?? "" } })

  const expectStreamed = async (response: request.Response) => {
    expect(response.status).toBe(200)
    expect(response.text).not.toContain("event: error")
    expect(await countSessionMessages()).toBeGreaterThan(0)
  }

  // The handler's own checks answer HTTP 200 with an SSE error frame: only guards set a status.
  const expectTurnedAway = async (response: request.Response) => {
    expect(response.status).toBe(200)
    expect(response.text).toContain("event: error")
    expect(response.text).toContain("data: Not Found")
    expect(await countSessionMessages()).toBe(0)
  }

  describe.each([["live"], ["playground"]] as const)("on the %s route", (type) => {
    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(type), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires a valid organization ID", async () => {
      await createContextForRole("owner", type)
      organizationId = null
      expectResponse(await subject(type), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })

    it("requires a valid agent ID", async () => {
      await createContextForRole("owner", type)
      agentId = null
      expectResponse(await subject(type), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("owner", type)
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(type), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("answers 404 for an unknown session", async () => {
      await createContextForRole("owner", type)
      agentSessionId = randomUUID()
      expectResponse(await subject(type), 404)
    })

    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("owner", type)
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(type), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })
  })

  // The live route is open to every project role, the playground route to owners and admins only.
  it.each([
    ["owner"],
    ["admin"],
    ["member"],
  ] as const)("lets a project %s stream on the live route", async (role) => {
    await createContextForRole(role, "live")
    await expectStreamed(await subject("live"))
  })

  it.each([
    ["owner"],
    ["admin"],
  ] as const)("lets a project %s stream on the playground route", async (role) => {
    await createContextForRole(role, "playground")
    await expectStreamed(await subject("playground"))
  })

  it("forbids a plain member on the playground route", async () => {
    await createContextForRole("member", "playground")
    expectResponse(await subject("playground"), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("turns away a playground session on the live route", async () => {
    await createContextForRole("owner", "playground")
    await expectTurnedAway(await subject("live"))
  })

  it("turns away a live session on the playground route", async () => {
    await createContextForRole("owner", "live")
    await expectTurnedAway(await subject("playground"))
  })
})
