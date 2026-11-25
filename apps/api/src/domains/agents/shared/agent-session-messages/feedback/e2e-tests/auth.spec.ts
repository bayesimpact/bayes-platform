import { randomUUID } from "node:crypto"
import { AgentMessageFeedbackRoutes } from "@bayes-platform/api-contracts"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
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
import {
  createOrganizationWithAgent,
  createOrganizationWithAgentMessage,
} from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import type { ProjectRoleKey } from "@/domains/projects/memberships/project-membership.types"
import { RoleGrant } from "@/domains/rbac/role-grant.entity"
import {
  addUserToReviewCampaign,
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import type { ReviewCampaignRoleKey } from "@/domains/review-campaigns/memberships/review-campaign-membership.types"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../../../test/request"
import { agentMessageFactory } from "../../agent-messages.factory"
import { AgentMessageFeedbackModule } from "../agent-message-feedback.module"

describe("Agent Message Feedback - Auth", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  // Variables for the tests
  let organizationId: string | null = randomUUID()
  let projectId: string | null = randomUUID()
  let agentId: string | null = randomUUID()
  let agentMessageId: string | null = randomUUID()
  let accessToken: string | null = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [AgentMessageFeedbackModule],
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
    organizationId = randomUUID()
    projectId = randomUUID()
    agentId = randomUUID()
    agentMessageId = randomUUID()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContextForRole = async (role: ProjectRoleKey) => {
    const { organization, project, agent, agentMessage, user } =
      await createOrganizationWithAgentMessage({
        repositories,
        params: {
          user: { authSubject, email: mockOidcEmailForSub(authSubject) },
          organizationMembership: { roleKeys: ["org_member"] },
          projectMembership: { roleKeys: [role] },
        },
        agentType: "conversation",
      })
    authSubject = user.authSubject!
    organizationId = organization.id
    projectId = project.id
    agentId = agent.id
    agentMessageId = agentMessage.id
    accessToken = "token"
    return { organization, project }
  }

  /** Switches the caller to an organization admin who holds no role on the project. */
  const switchToOrganizationAdminWithoutProjectRole = async ({
    organization,
  }: Awaited<ReturnType<typeof createContextForRole>>) => {
    const organizationAdminAuthSubject = `oidc|${randomUUID()}`
    await addUserToOrganization({
      repositories,
      organization,
      user: {
        authSubject: organizationAdminAuthSubject,
        email: mockOidcEmailForSub(organizationAdminAuthSubject),
      },
      membership: { roleKeys: ["org_admin"] },
    })
    authSubject = organizationAdminAuthSubject
  }

  describe("AgentMessageFeedbackRoutes.createOne", () => {
    const subject = async () =>
      request({
        route: AgentMessageFeedbackRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId, agentMessageId }),
        token: accessToken ?? undefined,
        request: { payload: { content: "Helpful answer" } },
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires a valid organization ID", async () => {
      await createContextForRole("project_owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })

    it("requires a valid project ID", async () => {
      await createContextForRole("project_member")
      projectId = null
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_member")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it.each([
      ["project_owner"],
      ["project_admin"],
      ["project_member"],
    ] as const)("allows a %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 201)
    })

    it("answers 404 for a message that does not exist", async () => {
      await createContextForRole("project_member")
      agentMessageId = randomUUID()
      expectResponse(await subject(), 404)
    })

    it("answers 404 for a message of someone else's conversation, even to a project owner", async () => {
      // The message belongs to a conversation of the project member created here.
      const { organization, project } = await createContextForRole("project_member")
      const projectOwnerAuthSubject = `oidc|${randomUUID()}`
      const { user: projectOwner } = await addUserToOrganization({
        repositories,
        organization,
        user: {
          authSubject: projectOwnerAuthSubject,
          email: mockOidcEmailForSub(projectOwnerAuthSubject),
        },
        membership: { roleKeys: ["org_member"] },
      })
      await addUserToProject({
        repositories,
        project,
        user: projectOwner,
        membership: { roleKeys: ["project_owner"] },
      })
      authSubject = projectOwnerAuthSubject

      expectResponse(await subject(), 404)
      expect(
        await repositories.agentMessageFeedbackRepository.count({
          where: { agentMessageId: agentMessageId ?? "" },
        }),
      ).toBe(0)
    })
  })

  describe("AgentMessageFeedbackRoutes.getAll", () => {
    const subject = async () =>
      request({
        route: AgentMessageFeedbackRoutes.getAll,
        pathParams: removeNullish({ organizationId, projectId, agentId }),
        token: accessToken ?? undefined,
      })

    it("requires an authentication token", async () => {
      accessToken = null
      expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
    })

    it("requires a valid organization ID", async () => {
      await createContextForRole("project_owner")
      organizationId = null
      expectResponse(await subject(), 400, AUTH_ERRORS.NO_ORGANIZATION_ID)
    })

    it("requires a valid project ID", async () => {
      await createContextForRole("project_owner")
      projectId = null
      expectResponse(await subject(), 404)
    })

    it("requires a valid agent ID", async () => {
      await createContextForRole("project_owner")
      agentId = null
      expectResponse(await subject(), 404)
    })

    it("requires the user to be a member of the organization", async () => {
      await createContextForRole("project_owner")
      authSubject = mockForeignAuthSubject()
      expectResponse(await subject(), 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })

    it("forbids an organization admin who holds no project role", async () => {
      const context = await createContextForRole("project_owner")
      await switchToOrganizationAdminWithoutProjectRole(context)
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("forbids a plain project member", async () => {
      await createContextForRole("project_member")
      expectResponse(await subject(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it.each([["project_owner"], ["project_admin"]] as const)("allows a %s", async (role) => {
      await createContextForRole(role)
      expectResponse(await subject(), 200)
    })
  })

  // A tester's campaign role gives the feedback key on the campaign's project, without a project row.
  describe("review campaign participants", () => {
    const createCampaignParticipantContext = async (
      roleKey: ReviewCampaignRoleKey = "review_campaign_tester",
    ) => {
      const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
        repositories,
        { agent: { type: "conversation" } },
      )
      const campaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory
          .active()
          .transient({ organization, project, agent, agentSettings })
          .build(),
      )
      const participantAuthSubject = `oidc|${randomUUID()}`
      const { user } = await addUserToReviewCampaign({
        repositories,
        organization,
        project,
        campaign,
        roleKeys: [roleKey],
        user: {
          authSubject: participantAuthSubject,
          email: mockOidcEmailForSub(participantAuthSubject),
        },
      })
      const agentSession = conversationAgentSessionFactory
        .transient({ organization, project, agent, user })
        .live()
        .build({ campaignId: campaign.id })
      await repositories.conversationAgentSessionRepository.save(agentSession)
      const agentMessage = agentMessageFactory
        .transient({ organization, project, session: agentSession, agentSettings })
        .assistant()
        .build()
      await repositories.agentMessageRepository.save(agentMessage)

      authSubject = participantAuthSubject
      organizationId = organization.id
      projectId = project.id
      agentId = agent.id
      agentMessageId = agentMessage.id
      accessToken = "token"
      return { organization, project, agent, agentSettings, campaign, agentMessage, user }
    }

    type TesterContext = Awaited<ReturnType<typeof createCampaignParticipantContext>>

    /** Makes the caller a tester of a second, active campaign of the same project. */
    const joinAnotherActiveCampaign = async ({
      organization,
      project,
      agent,
      agentSettings,
      user,
    }: TesterContext) => {
      const otherCampaign = await repositories.reviewCampaignRepository.save(
        reviewCampaignFactory
          .active()
          .transient({ organization, project, agent, agentSettings })
          .build(),
      )
      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .transient({ organization, project, campaign: otherCampaign, user })
          .build({ roleKeys: ["review_campaign_tester"] }),
      })
    }

    const expectNoFeedback = async ({ agentMessage }: TesterContext) =>
      expect(
        await repositories.agentMessageFeedbackRepository.count({
          where: { agentMessageId: agentMessage.id },
        }),
      ).toBe(0)

    const createFeedback = () =>
      request({
        route: AgentMessageFeedbackRoutes.createOne,
        pathParams: removeNullish({ organizationId, projectId, agentMessageId }),
        token: accessToken ?? undefined,
        request: { payload: { content: "Helpful answer" } },
      })

    it("lets a tester of an active campaign give feedback", async () => {
      const { agentMessage } = await createCampaignParticipantContext()
      expectResponse(await createFeedback(), 201)
      expect(
        await repositories.agentMessageFeedbackRepository.count({
          where: { agentMessageId: agentMessage.id },
        }),
      ).toBe(1)
    })

    it("forbids the tester once the campaign is closed", async () => {
      const { campaign } = await createCampaignParticipantContext()
      await repositories.reviewCampaignRepository.update(
        { id: campaign.id },
        { status: "closed", closedAt: new Date() },
      )

      expectResponse(await createFeedback(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("forbids feedback in a session of a closed campaign to a tester of another active campaign of the project", async () => {
      const context = await createCampaignParticipantContext()
      await joinAnotherActiveCampaign(context)
      await repositories.reviewCampaignRepository.update(
        { id: context.campaign.id },
        { status: "closed", closedAt: new Date() },
      )

      expectResponse(await createFeedback(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      await expectNoFeedback(context)
    })

    it("forbids feedback to someone removed from the session's campaign, even as a tester of another active campaign of the project", async () => {
      const context = await createCampaignParticipantContext()
      await joinAnotherActiveCampaign(context)
      await setup.dataSource.getRepository(RoleGrant).softDelete({
        userId: context.user.id,
        resourceType: "review_campaign",
        resourceId: context.campaign.id,
      })

      expectResponse(await createFeedback(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
      await expectNoFeedback(context)
    })

    it("forbids a reviewer-only participant", async () => {
      await createCampaignParticipantContext("review_campaign_reviewer")
      expectResponse(await createFeedback(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("forbids a tester to list the agent's feedback", async () => {
      await createCampaignParticipantContext()
      expectResponse(
        await request({
          route: AgentMessageFeedbackRoutes.getAll,
          pathParams: removeNullish({ organizationId, projectId, agentId }),
          token: accessToken ?? undefined,
        }),
        403,
        AUTH_ERRORS.UNAUTHORIZED_RESOURCE,
      )
    })
  })
})
