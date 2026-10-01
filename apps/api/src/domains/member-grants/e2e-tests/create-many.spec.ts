import { randomUUID } from "node:crypto"
import { MemberGrantsRoutes, MeRoutes } from "@caseai-connect/api-contracts"
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
import { MeModule } from "@/domains/me/me.module"
import {
  createOrganizationWithAgent,
  createOrganizationWithProject,
} from "@/domains/organizations/organization.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import { buildServiceUserEmail } from "@/domains/users/service-user.helpers"
import { userFactory } from "@/domains/users/user.factory"
import { USER_TYPE_SERVICE } from "@/domains/users/user.types"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  findAgentMembershipRow,
  findOrganizationMembershipRow,
  findProjectMembershipRow,
  findReviewCampaignMembershipRow,
} from "../../../../test/membership-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { MemberGrantsModule } from "../member-grants.module"

describe("Member grants - createMany", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [MemberGrantsModule, MeModule, ActivitiesModule],
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

  const subject = async (payload: typeof MemberGrantsRoutes.createMany.request.payload) =>
    request({ route: MemberGrantsRoutes.createMany, token: "token", request: { payload } })

  const createProjectContext = async () =>
    createOrganizationWithProject(repositories, { user: { authSubject } })

  describe("project target", () => {
    it("gives an unknown email admin access right away, with a never-signed-in account", async () => {
      const { organization, project } = await createProjectContext()

      const response = await subject({
        targetType: "project",
        targetId: project.id,
        emails: [" New.Person@Example.com ", "new.person@example.com"],
      })

      expectResponse(response, 201)
      expect(response.body.data).toEqual({ grantedEmails: ["new.person@example.com"] })
      const addedUser = await repositories.userRepository.findOneOrFail({
        where: { email: "new.person@example.com" },
      })
      expect(addedUser.authSubject).toBeNull()
      const organizationMembership = await findOrganizationMembershipRow(repositories, {
        userId: addedUser.id,
        organizationId: organization.id,
      })
      const projectMembership = await findProjectMembershipRow(repositories, {
        userId: addedUser.id,
        projectId: project.id,
      })
      expect(organizationMembership?.role).toBe("admin")
      expect(projectMembership?.role).toBe("admin")
      await expectActivityCreated("member_grant.create")
    })

    it("skips people who are already project members", async () => {
      const { project, user } = await createProjectContext()

      const response = await subject({
        targetType: "project",
        targetId: project.id,
        emails: [user.email],
      })

      expectResponse(response, 201)
      expect(response.body.data.grantedEmails).toEqual([])
      const ownerMembership = await findProjectMembershipRow(repositories, {
        userId: user.id,
        projectId: project.id,
      })
      expect(ownerMembership?.role).toBe("owner")
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
      expect(response.body.data.grantedEmails).toEqual([])
    })

    it("hands the access to the person at their first sign-in", async () => {
      const { project } = await createProjectContext()
      const newcomerSubject = `oidc|${randomUUID()}`
      const newcomerEmail = mockOidcEmailForSub(newcomerSubject)
      expectResponse(
        await subject({ targetType: "project", targetId: project.id, emails: [newcomerEmail] }),
        201,
      )

      authSubject = newcomerSubject
      const meResponse = await request({ route: MeRoutes.getMe, token: "token" })

      expectResponse(meResponse, 200)
      const linkedUser = await repositories.userRepository.findOneOrFail({
        where: { email: newcomerEmail },
      })
      expect(linkedUser.authSubject).toBe(newcomerSubject)
      expect(await repositories.userRepository.count({ where: { email: newcomerEmail } })).toBe(1)
      expect(
        await findProjectMembershipRow(repositories, {
          userId: linkedUser.id,
          projectId: project.id,
        }),
      ).not.toBeNull()
    })
  })

  describe("agent target", () => {
    it("gives agent member access plus the project and organization memberships it needs", async () => {
      const { organization, project, agent } = await createOrganizationWithAgent(repositories, {
        user: { authSubject },
      })

      const response = await subject({
        targetType: "agent",
        targetId: agent.id,
        emails: ["agent.member@example.com"],
      })

      expectResponse(response, 201)
      const addedUser = await repositories.userRepository.findOneOrFail({
        where: { email: "agent.member@example.com" },
      })
      const agentMembership = await findAgentMembershipRow(repositories, {
        userId: addedUser.id,
        agentId: agent.id,
      })
      const projectMembership = await findProjectMembershipRow(repositories, {
        userId: addedUser.id,
        projectId: project.id,
      })
      const organizationMembership = await findOrganizationMembershipRow(repositories, {
        userId: addedUser.id,
        organizationId: organization.id,
      })
      expect(agentMembership?.role).toBe("member")
      expect(projectMembership?.role).toBe("member")
      expect(organizationMembership?.role).toBe("member")
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

    it("gives the requested campaign role", async () => {
      const campaign = await createCampaign("active")

      const response = await subject({
        targetType: "review_campaign",
        targetId: campaign.id,
        emails: ["reviewer@example.com"],
        role: "reviewer",
      })

      expectResponse(response, 201)
      const addedUser = await repositories.userRepository.findOneOrFail({
        where: { email: "reviewer@example.com" },
      })
      expect(
        await findReviewCampaignMembershipRow(repositories, {
          userId: addedUser.id,
          campaignId: campaign.id,
          role: "reviewer",
        }),
      ).not.toBeNull()
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

    it("refuses to add members to a campaign that is not active", async () => {
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
