import { randomUUID } from "node:crypto"
import { ProjectMembershipRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { agentFactory } from "@/domains/agents/agent.factory"
import {
  agentMembershipFactory,
  saveAgentMembership,
} from "@/domains/agents/memberships/agent-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { AGENT_ROLE_PERMISSIONS } from "@/domains/rbac/rbac.constants"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ProjectsModule } from "../../projects.module"
import { addMemberByEmailToProject } from "../project-membership.factory"

describe("Project membership - getMemberRoles", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let memberUserId: string | null = randomUUID()
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule],
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
    authSubject = "oidc|123"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const subject = async () =>
    request({
      route: ProjectMembershipRoutes.getMemberRoles,
      pathParams: removeNullish({ organizationId, projectId, userId: memberUserId }),
      token: accessToken,
    })

  /**
   * The caller owns the project and its first agent. The member holds `project_member`,
   * `agent_member` on that agent and the tester role on an active campaign. A second agent has
   * no role for anyone.
   */
  const createContext = async () => {
    const { user, organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      { agent: { type: "conversation" } },
    )
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!

    const { addedUser: member } = await addMemberByEmailToProject({
      repositories,
      organization,
      project,
      user: { email: "member@example.com", authSubject: "oidc|member" },
      projectMembership: { role: "member" },
    })
    memberUserId = member.id
    await saveAgentMembership({
      repositories,
      membership: agentMembershipFactory
        .transient({ agent, user: member })
        .build({ role: "member" }),
    })
    const otherAgent = await repositories.agentRepository.save(
      agentFactory.transient({ organization, project }).build({ name: "Agent B" }),
    )
    const campaign = await repositories.reviewCampaignRepository.save(
      reviewCampaignFactory
        .active()
        .transient({ organization, project, agent, agentSettings })
        .build({ name: "Pilot" }),
    )
    await saveReviewCampaignMembership({
      repositories,
      membership: reviewCampaignMembershipFactory
        .tester()
        .transient({ organization, project, campaign, user: member })
        .build(),
    })
    return { project, agent, otherAgent, campaign, member }
  }

  it("returns the member's roles on the workspace, each agent and each campaign", async () => {
    const { project, agent, otherAgent, campaign } = await createContext()

    const response = await subject()

    expectResponse(response, 200)
    const { member, workspace, agents, campaigns } = response.body.data
    expect(member.userId).toBe(memberUserId)
    expect(workspace).toMatchObject({
      kind: "project",
      resourceId: project.id,
      resourceName: project.name,
      roles: [expect.objectContaining({ key: "project_member" })],
    })
    const agentRow = agents.find((row) => row.resourceId === agent.id)
    expect(agentRow).toMatchObject({
      kind: "agent",
      detail: "conversation",
      roles: [expect.objectContaining({ key: "agent_member" })],
    })
    expect([...(agentRow?.permissions ?? [])].sort()).toEqual(
      [...AGENT_ROLE_PERMISSIONS.agent_member].sort(),
    )
    // The member holds no role on the second agent.
    expect(agents.find((row) => row.resourceId === otherAgent.id)).toMatchObject({
      roles: [],
      permissions: [],
    })
    expect(campaigns).toEqual([
      expect.objectContaining({
        kind: "review_campaign",
        resourceId: campaign.id,
        resourceName: "Pilot",
        detail: "active",
        roles: [expect.objectContaining({ key: "review_campaign_tester" })],
      }),
    ])
  })

  it("should 404 when the user is not a member of the project", async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!
    memberUserId = randomUUID()

    const response = await subject()
    expectResponse(response, 404)
  })
})
