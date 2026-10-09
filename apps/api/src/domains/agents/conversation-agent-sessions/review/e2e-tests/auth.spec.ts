import { randomUUID } from "node:crypto"
import { ConversationReviewRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../../../test/e2e.helpers"
import {
  assignConversationReviewerToUser,
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../test/request"
import { ConversationAgentSessionsModule } from "../../conversation-agent-sessions.module"

describe("ConversationReviewRoutes.getOne - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organization: Organization
  let organizationId: string
  let projectId: string
  let agentId: string
  let agentSessionId: string
  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ConversationAgentSessionsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** A live conversation owned by the project owner, who is not the caller. */
  const createContext = async () => {
    const context = await createOrganizationWithAgentSession({
      repositories,
      agentType: "conversation",
      params: { agentSession: { type: "live" } },
    })
    organization = context.organization
    organizationId = context.organization.id
    projectId = context.project.id
    agentId = context.agent.id
    agentSessionId = context.agentSession.id
    return context
  }

  /** The caller: a plain member of the organization, with no project or agent membership. */
  const createCaller = async () => {
    const { user } = await addUserToOrganization({
      repositories,
      organization,
      user: { authSubject, email: mockOidcEmailForSub(authSubject) },
    })
    return user
  }

  const subject = async () =>
    request({
      route: ConversationReviewRoutes.getOne,
      pathParams: { organizationId, projectId, agentId, agentSessionId },
      token: accessToken,
    })

  it("requires an authentication token", async () => {
    await createContext()
    accessToken = undefined
    expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("rejects the owner of the project and agent, who does not hold the permission", async () => {
    const { user } = await createContext()
    authSubject = user.authSubject as string
    expectResponse(await subject(), 403)
  })

  it("rejects a platform superadmin who does not hold the conversation reviewer role", async () => {
    await createContext()
    const caller = await createCaller()
    await assignPlatformSuperadminToUser({ repositories, user: caller })
    expectResponse(await subject(), 403)
  })

  it("rejects a conversation reviewer outside the organization", async () => {
    await createContext()
    const outsider = userFactory.build({ authSubject, email: mockOidcEmailForSub(authSubject) })
    await repositories.userRepository.save(outsider)
    await assignConversationReviewerToUser({ repositories, user: outsider })
    expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
  })

  it("lets a conversation reviewer read the conversation without project or agent membership", async () => {
    await createContext()
    const caller = await createCaller()
    await assignConversationReviewerToUser({ repositories, user: caller })
    expectResponse(await subject(), 200)
  })
})
