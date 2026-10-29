import { randomUUID } from "node:crypto"
import {
  AgentSessionMessagesRoutes,
  ConversationAgentSessionsRoutes,
  MeRoutes,
  MyInvitationsRoutes,
  ProjectInvitationsRoutes,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { grantConversationReview } from "@/domains/agents/conversation-reviewers/agent-conversation-reviewer.factory"
import { MeModule } from "@/domains/me/me.module"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { REVIEW_CAMPAIGN_ROLES } from "@/domains/rbac/rbac.constants"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import type { ReviewCampaignMembershipRole } from "@/domains/review-campaigns/review-campaigns.types"
import { userFactory } from "@/domains/users/user.factory"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  findAgentMembershipRow,
  findOrganizationMembershipRow,
  findProjectMembershipRow,
  findReviewCampaignMembershipRow,
} from "../../../../test/membership-test.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { invitationFactory } from "../invitation.factory"
import { InvitationsModule } from "../invitations.module"

describe("Invitations - acceptOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let authSubject = `oidc|${randomUUID()}`
  let ownerSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [
        InvitationsModule,
        MeModule,
        ActivitiesModule,
        ConversationAgentSessionsModule,
      ],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    ownerSubject = `oidc|${randomUUID()}`
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const subject = async (invitationId: string) =>
    request({
      route: MyInvitationsRoutes.acceptOne,
      pathParams: { invitationId },
      token: "token",
    })

  const createInvitee = () =>
    repositories.userRepository.save(
      userFactory.build({ authSubject, email: mockOidcEmailForSub(authSubject) }),
    )

  describe("project target", () => {
    const createContext = async () => {
      const { organization, project } = await createOrganizationWithProject(repositories, {
        user: { authSubject: ownerSubject },
      })
      const invitee = await createInvitee()
      const invitation = await repositories.invitationRepository.save(
        invitationFactory.transient({ user: invitee, project }).build(),
      )
      return { organization, project, invitee, invitation }
    }

    it("gives project and organization admin access, and marks the invitation accepted", async () => {
      const { organization, project, invitee, invitation } = await createContext()

      expectResponse(await subject(invitation.id), 201)

      expect(
        (
          await findProjectMembershipRow(repositories, {
            userId: invitee.id,
            projectId: project.id,
          })
        )?.roleKeys,
      ).toEqual(["project_admin"])
      expect(
        (
          await findOrganizationMembershipRow(repositories, {
            userId: invitee.id,
            organizationId: organization.id,
          })
        )?.roleKeys,
      ).toEqual(["org_admin"])
      const acceptedInvitation = await repositories.invitationRepository.findOneByOrFail({
        id: invitation.id,
      })
      expect(acceptedInvitation.status).toBe("accepted")
      expect(acceptedInvitation.acceptedAt).not.toBeNull()
      await expectActivityCreated("invitation.accept")
    })

    it("promotes a project member to admin", async () => {
      const { project, invitee, invitation } = await createContext()
      await addUserToProject({ repositories, project, user: invitee })

      expectResponse(await subject(invitation.id), 201)

      expect(
        (
          await findProjectMembershipRow(repositories, {
            userId: invitee.id,
            projectId: project.id,
          })
        )?.roleKeys,
      ).toEqual(["project_admin"])
    })

    it("does nothing the second time", async () => {
      const { invitation } = await createContext()
      expectResponse(await subject(invitation.id), 201)

      expectResponse(await subject(invitation.id), 201)
    })

    it("answers 404 for someone else's invitation", async () => {
      const { invitation } = await createContext()
      authSubject = `oidc|${randomUUID()}`

      expectResponse(await subject(invitation.id), 404)
      expect(
        (await repositories.invitationRepository.findOneByOrFail({ id: invitation.id })).status,
      ).toBe("pending")
    })

    it("answers 404 for an unknown invitation", async () => {
      await createContext()
      expectResponse(await subject(randomUUID()), 404)
    })

    it("refuses a revoked invitation", async () => {
      const { project, invitee, invitation } = await createContext()
      await repositories.invitationRepository.update({ id: invitation.id }, { status: "revoked" })

      expectResponse(await subject(invitation.id), 409)
      expect(
        await findProjectMembershipRow(repositories, { userId: invitee.id, projectId: project.id }),
      ).toBeNull()
    })
  })

  describe("agent target", () => {
    it("gives agent member access plus the project and organization memberships it needs", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
        user: { authSubject: ownerSubject },
      })
      const invitee = await createInvitee()
      const invitation = await repositories.invitationRepository.save(
        invitationFactory.transient({ user: invitee, agent }).build(),
      )

      expectResponse(await subject(invitation.id), 201)

      expect(
        (await findAgentMembershipRow(repositories, { userId: invitee.id, agentId: agent.id }))
          ?.roleKeys,
      ).toEqual(["agent_member"])
      expect(
        (
          await findProjectMembershipRow(repositories, {
            userId: invitee.id,
            projectId: project.id,
          })
        )?.roleKeys,
      ).toEqual(["project_member"])
      expect(
        (
          await findOrganizationMembershipRow(repositories, {
            userId: invitee.id,
            organizationId: organization.id,
          })
        )?.roleKeys,
      ).toEqual(["org_member"])
    })
  })

  describe("agent target, invitee who only reviews the agent", () => {
    it("gives agent member access next to the review grant", async () => {
      const { agent } = await createOrganizationWithAgent(repositories, {
        user: { authSubject: ownerSubject },
      })
      const invitee = await createInvitee()
      await grantConversationReview({ repositories, user: invitee, agent })
      const invitation = await repositories.invitationRepository.save(
        invitationFactory.transient({ user: invitee, agent }).build(),
      )

      expectResponse(await subject(invitation.id), 201)

      const agentRow = await findAgentMembershipRow(repositories, {
        userId: invitee.id,
        agentId: agent.id,
      })
      expect(agentRow?.roleKeys.sort()).toEqual(
        ["agent_conversation_reviewer", "agent_member"].sort(),
      )
    })
  })

  describe("review campaign target", () => {
    const createCampaignInvitation = async (
      status: "active" | "closed",
      role: ReviewCampaignMembershipRole = "reviewer",
    ) => {
      const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
        repositories,
        { user: { authSubject: ownerSubject }, agent: { type: "conversation" } },
      )
      const campaignFactory =
        status === "active" ? reviewCampaignFactory.active() : reviewCampaignFactory.closed()
      const reviewCampaign = await repositories.reviewCampaignRepository.save(
        campaignFactory.transient({ organization, project, agent, agentSettings }).build(),
      )
      const invitee = await createInvitee()
      const invitation = await repositories.invitationRepository.save(
        invitationFactory.transient({ user: invitee, reviewCampaign }).build({ role }),
      )
      return { organization, project, agent, reviewCampaign, invitee, invitation }
    }

    const findCampaignRole = (role: ReviewCampaignMembershipRole) =>
      repositories.roleRepository.findOneOrFail({ where: { key: REVIEW_CAMPAIGN_ROLES[role] } })

    it.each([
      ["tester"],
      ["reviewer"],
    ] as const)("gives the invited %s role and an organization membership, but no project role", async (role) => {
      const { organization, project, reviewCampaign, invitee, invitation } =
        await createCampaignInvitation("active", role)
      const campaignRole = await findCampaignRole(role)

      expectResponse(await subject(invitation.id), 201)

      expect(
        (
          await findReviewCampaignMembershipRow(repositories, {
            userId: invitee.id,
            campaignId: reviewCampaign.id,
            roleKey: REVIEW_CAMPAIGN_ROLES[role],
          })
        )?.roleId,
      ).toBe(campaignRole.id)
      expect(
        (
          await findOrganizationMembershipRow(repositories, {
            userId: invitee.id,
            organizationId: organization.id,
          })
        )?.roleKeys,
      ).toEqual(["org_member"])
      expect(
        await findProjectMembershipRow(repositories, { userId: invitee.id, projectId: project.id }),
      ).toBeNull()
    })

    it("keeps the project member row the invitee already holds", async () => {
      const { project, invitee, invitation } = await createCampaignInvitation("active", "tester")
      const { membership: projectMembership } = await addUserToProject({
        repositories,
        project,
        user: invitee,
        membership: { roleKeys: ["project_member"] },
      })

      expectResponse(await subject(invitation.id), 201)

      const projectRow = await findProjectMembershipRow(repositories, {
        userId: invitee.id,
        projectId: project.id,
      })
      expect(projectRow?.id).toBe(projectMembership.id)
      expect(projectRow?.roleKeys).toEqual(["project_member"])
    })

    it("lets an invited tester chat with the campaign agent until the campaign closes", async () => {
      const { project, agent, reviewCampaign, invitation } = await createCampaignInvitation(
        "active",
        "tester",
      )
      expectResponse(await subject(invitation.id), 201)
      const agentPathParams = {
        organizationId: project.organizationId,
        projectId: project.id,
        agentId: agent.id,
      }
      const createSession = () =>
        request({
          route: ConversationAgentSessionsRoutes.live.createOne,
          pathParams: agentPathParams,
          token: "token",
        })

      const sessionResponse = await createSession()
      expectResponse(sessionResponse, 201)
      const messagesResponse = await request({
        route: AgentSessionMessagesRoutes.live.getAll,
        pathParams: { ...agentPathParams, agentSessionId: sessionResponse.body.data.id },
        token: "token",
      })
      expectResponse(messagesResponse, 201)
      expect(messagesResponse.body.data).toEqual([])

      await repositories.reviewCampaignRepository.update(
        { id: reviewCampaign.id },
        { status: "closed", closedAt: new Date() },
      )

      expectResponse(await createSession(), 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    })

    it("refuses while the campaign is not active", async () => {
      const { invitation } = await createCampaignInvitation("closed")

      expectResponse(await subject(invitation.id), 409)
    })
  })

  it("lets a person invited before their first sign-in accept once signed in", async () => {
    const { project } = await createOrganizationWithProject(repositories, {
      user: { authSubject: ownerSubject },
    })
    const newcomerSubject = `oidc|${randomUUID()}`
    const newcomerEmail = mockOidcEmailForSub(newcomerSubject)
    authSubject = ownerSubject
    expectResponse(
      await request({
        route: ProjectInvitationsRoutes.createMany,
        pathParams: { organizationId: project.organizationId, projectId: project.id },
        token: "token",
        request: { payload: { emails: [newcomerEmail] } },
      }),
      201,
    )

    authSubject = newcomerSubject
    expectResponse(await request({ route: MeRoutes.getMe, token: "token" }), 200)
    const mine = await request({ route: MyInvitationsRoutes.getAll, token: "token" })
    expectResponse(mine, 200)
    expect(mine.body.data.invitations).toHaveLength(1)

    expectResponse(await subject(mine.body.data.invitations[0]!.id), 201)

    const newcomer = await repositories.userRepository.findOneByOrFail({ email: newcomerEmail })
    expect(newcomer.authSubject).toBe(newcomerSubject)
    expect(
      await findProjectMembershipRow(repositories, { userId: newcomer.id, projectId: project.id }),
    ).not.toBeNull()
  })
})
