import { randomUUID } from "node:crypto"
import { InvitationsRoutes } from "@caseai-connect/api-contracts"
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
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
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
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { InvitationsModule } from "../invitations.module"

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

  const subject = async (payload: typeof InvitationsRoutes.createMany.request.payload) =>
    request({ route: InvitationsRoutes.createMany, token: "token", request: { payload } })

  const createProjectContext = async () =>
    createOrganizationWithProject(repositories, { user: { authSubject } })

  const findPendingInvitation = (params: { userId: string; targetId: string }) =>
    repositories.invitationRepository.findOne({ where: { ...params, status: "pending" } })

  describe("project target", () => {
    it("invites an unknown email without giving access yet, with a never-signed-in account", async () => {
      const { organization, project } = await createProjectContext()

      const response = await subject({
        targetType: "project",
        targetId: project.id,
        emails: [" New.Person@Example.com ", "new.person@example.com"],
      })

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

      const response = await subject({
        targetType: "project",
        targetId: project.id,
        emails: ["existing@example.com"],
      })

      expectResponse(response, 201)
      expect(response.body.data.invitations).toHaveLength(1)
      expect(
        await findPendingInvitation({ userId: existingUser.id, targetId: project.id }),
      ).not.toBeNull()
    })

    it("skips people who are already project members", async () => {
      const { project, user } = await createProjectContext()

      const response = await subject({
        targetType: "project",
        targetId: project.id,
        emails: [user.email],
      })

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([])
    })

    it("skips people who already have a pending invitation", async () => {
      const { project } = await createProjectContext()
      const payload = {
        targetType: "project" as const,
        targetId: project.id,
        emails: ["twice@example.com"],
      }
      expectResponse(await subject(payload), 201)

      const response = await subject(payload)

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

      const response = await subject({
        targetType: "project",
        targetId: project.id,
        emails: [serviceEmail, buildServiceUserEmail("other-app", randomUUID())],
      })

      expectResponse(response, 201)
      expect(response.body.data.invitations).toEqual([])
    })
  })

  describe("agent target", () => {
    it("invites as an agent member, without giving access yet", async () => {
      const { project, agent } = await createOrganizationWithAgent(repositories, {
        user: { authSubject },
      })

      const response = await subject({
        targetType: "agent",
        targetId: agent.id,
        emails: ["agent.member@example.com"],
      })

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

      const response = await subject({
        targetType: "review_campaign",
        targetId: campaign.id,
        emails: ["reviewer@example.com"],
        role: "reviewer",
      })

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
          role: "reviewer",
        }),
      ).toBeNull()
    })

    it("requires a valid campaign role", async () => {
      const campaign = await createCampaign("active")

      expectResponse(
        await subject({
          targetType: "review_campaign",
          targetId: campaign.id,
          emails: ["reviewer@example.com"],
        }),
        400,
      )
      expectResponse(
        await subject({
          targetType: "review_campaign",
          targetId: campaign.id,
          emails: ["reviewer@example.com"],
          role: "owner",
        }),
        400,
      )
    })

    it("refuses to invite members to a campaign that is not active", async () => {
      const campaign = await createCampaign("draft")

      expectResponse(
        await subject({
          targetType: "review_campaign",
          targetId: campaign.id,
          emails: ["tester@example.com"],
          role: "tester",
        }),
        409,
      )
    })
  })
})
