import { randomUUID } from "node:crypto"
import { AgentMembershipRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { AgentsModule } from "../../agents.module"
import { grantConversationReview } from "../../conversation-reviewers/agent-conversation-reviewer.factory"
import { addMemberByEmailToAgent } from "../agent-membership.factory"

/**
 * `agent_conversation_reviewer` sits on `temp_agent` rows. These tests pin that the agent's roles,
 * and everything read from them, stay as they were when someone is granted the review.
 */
describe("Agent Memberships - conversation reviewers", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentsModule],
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
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  /** An agent owned by the caller, with one plain member. */
  const createContext = async () => {
    const context = await createOrganizationWithAgent(repositories, { user: { authSubject } })
    const { addedUser: member } = await addMemberByEmailToAgent({
      repositories,
      agent: context.agent,
    })
    return { ...context, member }
  }

  const listMembers = (context: Awaited<ReturnType<typeof createContext>>) =>
    request({
      route: AgentMembershipRoutes.getAll,
      pathParams: {
        organizationId: context.organization.id,
        projectId: context.project.id,
        agentId: context.agent.id,
      },
      token: "token",
    })

  it("keeps the agent's member list as it was when people are granted the review", async () => {
    const context = await createContext()
    const outsideReviewer = userFactory.build()
    await repositories.userRepository.save(outsideReviewer)
    await grantConversationReview({ repositories, user: context.user, agent: context.agent })
    await grantConversationReview({ repositories, user: context.member, agent: context.agent })
    await grantConversationReview({ repositories, user: outsideReviewer, agent: context.agent })

    const response = await listMembers(context)

    expectResponse(response, 200)
    const rolesByUserId = Object.fromEntries(
      response.body.data.map((membership) => [membership.userId, membership.role]),
    )
    expect(rolesByUserId).toEqual({ [context.user.id]: "owner", [context.member.id]: "member" })
  })

  it("lets an owner who reviews the agent keep managing its members", async () => {
    const context = await createContext()
    await grantConversationReview({ repositories, user: context.user, agent: context.agent })

    expectResponse(await listMembers(context), 200)
  })
})
