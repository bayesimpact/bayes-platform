import { randomUUID } from "node:crypto"
import {
  type CreateProjectInvitationsRequestDto,
  ProjectInvitationsRoutes,
} from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { agentFactory } from "@/domains/agents/agent.factory"
import { addUserToAgent } from "@/domains/agents/memberships/agent-membership.factory"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { buildServiceUserEmail } from "@/domains/users/service-user.helpers"
import { userFactory } from "@/domains/users/user.factory"
import { USER_TYPE_SERVICE } from "@/domains/users/user.types"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  findAgentMembershipRow,
  findOrganizationMembershipRow,
  findProjectMembershipRow,
  findReviewCampaignMembershipRow,
} from "../../../../test/membership-test.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { InvitationsModule } from "../invitations.module"
import { type InvitationRouteTarget, invitationRoutesFor } from "./invitation-routes.helpers"
import { createWorkspaceWithTwoAgents } from "./workspace-invitation.helpers"

describe("Invitations - createMany", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [InvitationsModule, ActivitiesModule],
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
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const subject = async (
    target: InvitationRouteTarget,
    payload: { emails: string[]; role?: string },
  ) => {
    const { routes, pathParams } = invitationRoutesFor(target)
    return request({
      route: routes.createMany,
      pathParams,
      token: "token",
      // `role` is checked by the API, so tests may send invalid values.
      request: { payload: payload as { emails: string[]; role: "tester" } },
    })
  }

  const createProjectContext = async () =>
    createOrganizationWithProject(repositories, { user: { authSubject } })

  const findPendingInvitation = (params: { userId: string; targetId: string }) =>
    repositories.invitationRepository.findOne({ where: { ...params, status: "pending" } })

  describe("project target", () => {
    it("invites an unknown email without giving access yet, with a never-signed-in account", async () => {
      const { organization, project } = await createProjectContext()

      const response = await subject(
        { project },
        {
          emails: [" New.Person@Example.com ", "new.person@example.com"],
        },
      )

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([
        expect.objectContaining({
          targetType: "project",
          targetId: project.id,
          invitedEmail: "new.person@example.com",
          role: "admin",
          status: "pending",
          organizationName: organization.name,
          projectName: project.name,
          targetName: project.name,
        }),
      ])
      const invitedUser = await repositories.userRepository.findOneOrFail({
        where: { email: "new.person@example.com" },
      })
      expect(invitedUser.authSubject).toBeNull()
      expect(
        await findPendingInvitation({ userId: invitedUser.id, targetId: project.id }),
      ).not.toBeNull()
      expect(
        await findOrganizationMembershipRow(repositories, {
          userId: invitedUser.id,
          organizationId: organization.id,
        }),
      ).toBeNull()
      expect(
        await findProjectMembershipRow(repositories, {
          userId: invitedUser.id,
          projectId: project.id,
        }),
      ).toBeNull()
      await expectActivityCreated("invitation.invite")
    })

    it("invites a person who already has an account", async () => {
      const { project } = await createProjectContext()
      const existingUser = await repositories.userRepository.save(
        userFactory.build({ email: "existing@example.com" }),
      )

      const response = await subject(
        { project },
        {
          emails: ["existing@example.com"],
        },
      )

      expectResponse(response, 201)
      expect(response.body.data.invitations).toHaveLength(1)
      expect(
        await findPendingInvitation({ userId: existingUser.id, targetId: project.id }),
      ).not.toBeNull()
    })

    it("skips people who are already project owners or admins", async () => {
      const { project, user } = await createProjectContext()

      const response = await subject(
        { project },
        {
          emails: [user.email],
        },
      )

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([])
    })

    it("does not promote a project member to admin", async () => {
      const { project } = await createProjectContext()
      const { user: member } = await addUserToProject({ repositories, project })

      const response = await subject({ project }, { emails: [member.email] })

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([])
      expect(response.body.data.grantedEmails).toEqual([])
    })

    it("skips people who already have a pending invitation", async () => {
      const { project } = await createProjectContext()
      const payload = { emails: ["twice@example.com"] }
      expectResponse(await subject({ project }, payload), 201)

      const response = await subject({ project }, payload)

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([])
      expect(
        await repositories.invitationRepository.count({ where: { targetId: project.id } }),
      ).toBe(1)
    })

    it("skips service identities", async () => {
      const { project } = await createProjectContext()
      const serviceEmail = buildServiceUserEmail("helpful-assistant", randomUUID())
      await repositories.userRepository.save(
        userFactory.build({ email: serviceEmail, type: USER_TYPE_SERVICE }),
      )

      const response = await subject(
        { project },
        {
          emails: [serviceEmail, buildServiceUserEmail("other-app", randomUUID())],
        },
      )

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([])
    })
  })

  describe("agent target", () => {
    it("invites as an agent member, without giving access yet", async () => {
      const { project, agent } = await createOrganizationWithAgent(repositories, {
        user: { authSubject },
      })

      const response = await subject(
        { agent },
        {
          emails: ["agent.member@example.com"],
        },
      )

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([
        expect.objectContaining({ targetType: "agent", role: "member", targetName: agent.name }),
      ])
      const invitedUser = await repositories.userRepository.findOneOrFail({
        where: { email: "agent.member@example.com" },
      })
      expect(
        await findAgentMembershipRow(repositories, { userId: invitedUser.id, agentId: agent.id }),
      ).toBeNull()
      expect(
        await findProjectMembershipRow(repositories, {
          userId: invitedUser.id,
          projectId: project.id,
        }),
      ).toBeNull()
    })
  })

  describe("review campaign target", () => {
    const createCampaign = async (status: "active" | "draft") => {
      const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
        repositories,
        { user: { authSubject } },
      )
      const campaignFactory =
        status === "active" ? reviewCampaignFactory.active() : reviewCampaignFactory.draft()
      return repositories.reviewCampaignRepository.save(
        campaignFactory.transient({ organization, project, agent, agentSettings }).build(),
      )
    }

    it("stores the requested campaign role, without giving access yet", async () => {
      const campaign = await createCampaign("active")

      const response = await subject(
        { reviewCampaign: campaign },
        {
          emails: ["reviewer@example.com"],
          role: "reviewer",
        },
      )

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([
        expect.objectContaining({ role: "reviewer", targetName: campaign.name }),
      ])
      const invitedUser = await repositories.userRepository.findOneOrFail({
        where: { email: "reviewer@example.com" },
      })
      expect(
        await findReviewCampaignMembershipRow(repositories, {
          userId: invitedUser.id,
          campaignId: campaign.id,
          roleKey: "review_campaign_reviewer",
        }),
      ).toBeNull()
    })

    it("requires a valid campaign role", async () => {
      const campaign = await createCampaign("active")

      expectResponse(
        await subject(
          { reviewCampaign: campaign },
          {
            emails: ["reviewer@example.com"],
          },
        ),
        400,
      )
      expectResponse(
        await subject(
          { reviewCampaign: campaign },
          {
            emails: ["reviewer@example.com"],
            role: "owner",
          },
        ),
        400,
      )
    })

    it("skips someone who already holds the campaign role", async () => {
      const campaign = await createCampaign("active")
      const participant = await repositories.userRepository.save(
        userFactory.build({ email: "participant@example.com" }),
      )
      const organization = await repositories.organizationRepository.findOneByOrFail({
        id: campaign.organizationId,
      })
      const project = await repositories.projectRepository.findOneByOrFail({
        id: campaign.projectId,
      })
      await saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .withRoles("review_campaign_tester")
          .transient({ organization, project, campaign, user: participant })
          .build(),
      })

      const response = await subject(
        { reviewCampaign: campaign },
        { emails: [participant.email], role: "tester" },
      )

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([])
    })

    it("refuses to invite members to a campaign that is not active", async () => {
      const campaign = await createCampaign("draft")

      expectResponse(
        await subject(
          { reviewCampaign: campaign },
          {
            emails: ["tester@example.com"],
            role: "tester",
          },
        ),
        409,
      )
    })
  })

  describe("workspace invitation with agents", () => {
    const createContext = () => createWorkspaceWithTwoAgents(repositories, authSubject)

    const inviteToWorkspace = (
      project: { id: string; organizationId: string },
      payload: CreateProjectInvitationsRequestDto,
    ) =>
      request({
        route: ProjectInvitationsRoutes.createMany,
        pathParams: { organizationId: project.organizationId, projectId: project.id },
        token: "token",
        request: { payload },
      })

    it("invites a newcomer as a member of the workspace and of the agents picked", async () => {
      const { project, firstAgent, secondAgent } = await createContext()

      const response = await inviteToWorkspace(project, {
        emails: ["newcomer@example.com"],
        role: "member",
        agentIds: [secondAgent.id, firstAgent.id],
      })

      expectResponse(response, 201)
      expect(response.body.data.grantedEmails).toEqual([])
      expect(response.body.data.invitations).toEqual([
        expect.objectContaining({
          targetType: "project",
          invitedEmail: "newcomer@example.com",
          role: "member",
          agents: [
            { id: firstAgent.id, name: "Helpful Assistant" },
            { id: secondAgent.id, name: "Scheduling Bot" },
          ],
        }),
      ])
      const invitedUser = await repositories.userRepository.findOneByOrFail({
        email: "newcomer@example.com",
      })
      expect(
        await findAgentMembershipRow(repositories, {
          userId: invitedUser.id,
          agentId: firstAgent.id,
        }),
      ).toBeNull()
    })

    it("gives no agent to an admin of the workspace, who is admin of every agent", async () => {
      const { project, firstAgent } = await createContext()

      const response = await inviteToWorkspace(project, {
        emails: ["admin@example.com"],
        role: "admin",
        agentIds: [firstAgent.id],
      })

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([
        expect.objectContaining({ role: "admin", agents: [] }),
      ])
    })

    it("gives a member already in the workspace the agents they miss, with no invitation", async () => {
      const { project, firstAgent, secondAgent } = await createContext()
      const { user: member } = await addUserToProject({ repositories, project })
      await addUserToAgent({ repositories, agent: firstAgent, user: member })

      const response = await inviteToWorkspace(project, {
        emails: [member.email],
        role: "member",
        agentIds: [firstAgent.id, secondAgent.id],
      })

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([])
      expect(response.body.data.grantedEmails).toEqual([member.email])
      expect(
        await findAgentMembershipRow(repositories, {
          userId: member.id,
          agentId: secondAgent.id,
        }),
      ).not.toBeNull()
      expect(await repositories.invitationRepository.count({ where: { userId: member.id } })).toBe(
        0,
      )
    })

    it("adds the agents a pending member invitation misses to it", async () => {
      const { project, firstAgent, secondAgent } = await createContext()
      await inviteToWorkspace(project, {
        emails: ["newcomer@example.com"],
        role: "member",
        agentIds: [firstAgent.id],
      })

      const response = await inviteToWorkspace(project, {
        emails: ["newcomer@example.com"],
        role: "member",
        agentIds: [firstAgent.id, secondAgent.id],
      })

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([
        expect.objectContaining({
          invitedEmail: "newcomer@example.com",
          agents: [
            { id: firstAgent.id, name: "Helpful Assistant" },
            { id: secondAgent.id, name: "Scheduling Bot" },
          ],
        }),
      ])
      expect(
        await repositories.invitationRepository.count({
          where: { invitedEmail: "newcomer@example.com" },
        }),
      ).toBe(1)
    })

    it("leaves a pending admin invitation as it is", async () => {
      const { project, firstAgent } = await createContext()
      await inviteToWorkspace(project, { emails: ["newcomer@example.com"], role: "admin" })

      const response = await inviteToWorkspace(project, {
        emails: ["newcomer@example.com"],
        role: "member",
        agentIds: [firstAgent.id],
      })

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([])
      const invitation = await repositories.invitationRepository.findOneByOrFail({
        invitedEmail: "newcomer@example.com",
      })
      expect(invitation).toEqual(expect.objectContaining({ role: "admin", agentIds: [] }))
    })

    it("leaves an admin of the workspace as they are", async () => {
      const { project, secondAgent } = await createContext()
      const { user: admin } = await addUserToProject({
        repositories,
        project,
        membership: { roleKeys: ["project_admin"] },
      })

      const response = await inviteToWorkspace(project, {
        emails: [admin.email],
        role: "member",
        agentIds: [secondAgent.id],
      })

      expectResponse(response, 201)
      expect(response.body.data).toEqual(
        expect.objectContaining({ invitations: [], grantedEmails: [] }),
      )
      expect(
        await findAgentMembershipRow(repositories, { userId: admin.id, agentId: secondAgent.id }),
      ).toBeNull()
    })

    it("answers 404 for an agent of another workspace", async () => {
      const { project } = await createContext()
      const { agent: otherAgent } = await createOrganizationWithAgent(repositories)

      const response = await inviteToWorkspace(project, {
        emails: ["newcomer@example.com"],
        role: "member",
        agentIds: [otherAgent.id],
      })

      expectResponse(response, 404)
      expect(await repositories.invitationRepository.count()).toBe(0)
    })

    it("refuses an agent the inviter cannot invite people to", async () => {
      const { organization, project } = await createContext()
      const agentWithoutInviterRole = await repositories.agentRepository.save(
        agentFactory.transient({ organization, project }).build(),
      )

      const response = await inviteToWorkspace(project, {
        emails: ["newcomer@example.com"],
        role: "member",
        agentIds: [agentWithoutInviterRole.id],
      })

      expectResponse(response, 403)
      expect(await repositories.invitationRepository.count()).toBe(0)
    })

    it("answers 400 for an unknown workspace role", async () => {
      const { project } = await createContext()

      const response = await inviteToWorkspace(project, {
        emails: ["newcomer@example.com"],
        role: "owner" as "admin",
      })

      expectResponse(response, 400)
    })
  })
})
