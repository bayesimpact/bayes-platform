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
 * `agent_conversation_reviewer` is a row of its own on the agent, next to the person's member
 * role. The backoffice grants and revokes it: these tests pin that the studio's member list and
 * removals leave it alone.
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
      response.body.data.map((membership) => [
        membership.userId,
        membership.roles.map((role) => role.key),
      ]),
    )
    expect(rolesByUserId).toEqual({
      [context.user.id]: ["agent_owner"],
      [context.member.id]: ["agent_member"],
    })
  })

  it("lets an owner who reviews the agent keep managing its members", async () => {
    const context = await createContext()
    await grantConversationReview({ repositories, user: context.user, agent: context.agent })

    expectResponse(await listMembers(context), 200)
  })

  const removeMember = (
    context: Awaited<ReturnType<typeof createContext>>,
    agentMembershipId: string,
  ) =>
    request({
      route: AgentMembershipRoutes.deleteOne,
      pathParams: {
        organizationId: context.organization.id,
        projectId: context.project.id,
        agentId: context.agent.id,
        agentMembershipId,
      },
      token: "token",
    })

  const roleKeysOn = async (userId: string, agentId: string) => {
    const rows = await repositories.userMembershipRepository.find({
      where: { userId, resourceType: "agent", resourceId: agentId },
      relations: { rbacRole: true },
    })
    return rows.map((row) => row.rbacRole?.key).sort()
  }

  it("removes a member's role from the agent and keeps their review grant", async () => {
    const context = await createContext()
    await grantConversationReview({ repositories, user: context.member, agent: context.agent })
    const [memberRow] = await repositories.userMembershipRepository.find({
      where: { userId: context.member.id, resourceType: "agent", resourceId: context.agent.id },
    })

    expectResponse(await removeMember(context, memberRow?.id ?? ""), 200)

    expect(await roleKeysOn(context.member.id, context.agent.id)).toEqual([
      "agent_conversation_reviewer",
    ])
  })

  it("leaves a person who only reviews the agent as they are", async () => {
    const context = await createContext()
    const reviewer = userFactory.build()
    await repositories.userRepository.save(reviewer)
    await grantConversationReview({ repositories, user: reviewer, agent: context.agent })
    const [reviewerRow] = await repositories.userMembershipRepository.find({
      where: { userId: reviewer.id, resourceType: "agent", resourceId: context.agent.id },
    })

    expectResponse(await removeMember(context, reviewerRow?.id ?? ""), 200)

    expect(await roleKeysOn(reviewer.id, context.agent.id)).toEqual(["agent_conversation_reviewer"])
  })
})
