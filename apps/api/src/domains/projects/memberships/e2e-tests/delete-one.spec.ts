import { ProjectMembershipRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import {
  reviewCampaignMembershipFactory,
  saveReviewCampaignMembership,
} from "@/domains/review-campaigns/memberships/review-campaign-membership.factory"
import { reviewCampaignFactory } from "@/domains/review-campaigns/review-campaign.factory"
import type { ReviewCampaignMembershipRole } from "@/domains/review-campaigns/review-campaigns.types"
import type { User } from "@/domains/users/user.entity"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import type { Project } from "../../project.entity"
import { projectFactory } from "../../project.factory"
import { ProjectsModule } from "../../projects.module"
import { addMemberByEmailToProject } from "../project-membership.factory"

describe("Project membership - deleteOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let membershipId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
    await ensureRbacCatalog(setup.module)
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = "oidc|123"
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { organization, project, user } = await createOrganizationWithProject(repositories)

    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!

    // A member who has already signed in
    const { membership, addedUser } = await addMemberByEmailToProject({
      repositories,
      project,
      user: { email: "signed-in@example.com", authSubject: "oidc|signed-in" },
      projectMembership: { role: "member" },
    })
    membershipId = membership.id

    return { organization, project, user, addedUser, membership }
  }

  const subject = async () =>
    request({
      route: ProjectMembershipRoutes.deleteOne,
      pathParams: removeNullish({ organizationId, projectId, membershipId }),
      token: accessToken,
    })

  it("should successfully remove a membership", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body).toEqual({ data: { success: true } })

    // Verify the membership is actually deleted from the database
    const deletedMembership = await repositories.userMembershipRepository.findOne({
      where: { id: membershipId },
    })
    expect(deletedMembership).toBeNull()
    await expectActivityCreated("projectMembership.delete")
  })

  it("should also delete a never-signed-in user when removing their last membership", async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!

    const { membership } = await addMemberByEmailToProject({ repositories, project })
    membershipId = membership.id

    // Now remove the membership
    const response = await subject()
    expectResponse(response, 200)

    const deletedUser = await repositories.userRepository.findOne({
      where: { id: membership.userId },
    })
    expect(deletedUser).toBeNull()
  })

  it("should keep a never-signed-in user who still has another membership", async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!

    const { membership, addedUser } = await addMemberByEmailToProject({
      repositories,
      organization,
      project,
    })
    membershipId = membership.id

    const response = await subject()
    expectResponse(response, 200)

    // The organization membership is still there, so the account stays
    const remainingUser = await repositories.userRepository.findOne({
      where: { id: addedUser.id },
    })
    expect(remainingUser).not.toBeNull()
  })

  it("should NOT delete a real user when removing their membership", async () => {
    const { addedUser } = await createContext()

    const response = await subject()
    expectResponse(response, 200)

    const user = await repositories.userRepository.findOne({
      where: { id: addedUser.id },
    })
    expect(user).not.toBeNull()
  })

  describe("review campaign roles", () => {
    const createActiveCampaign = async (organization: Organization, project: Project) => {
      const agent = await repositories.agentRepository.save(
        agentFactory.transient({ organization, project }).build(),
      )
      const agentSettings = await repositories.agentSettingsRepository.save(
        agentSettingsFactory.transient({ organization, project, agent }).build(),
      )
      return repositories.reviewCampaignRepository.save(
        reviewCampaignFactory
          .active()
          .transient({ organization, project, agent, agentSettings })
          .build(),
      )
    }

    const addCampaignRole = async ({
      organization,
      project,
      campaign,
      user,
      role,
    }: {
      organization: Organization
      project: Project
      campaign: Awaited<ReturnType<typeof createActiveCampaign>>
      user: User
      role: ReviewCampaignMembershipRole
    }) =>
      saveReviewCampaignMembership({
        repositories,
        membership: reviewCampaignMembershipFactory
          .transient({ organization, project, campaign, user })
          .build({ role }),
      })

    const findCampaignRows = (userId: string, campaignId: string) =>
      repositories.userMembershipRepository.find({
        where: { userId, resourceType: "review_campaign", resourceId: campaignId },
      })

    it("removes the member's roles on the project's campaigns and keeps those on another project's", async () => {
      const { organization, project, addedUser } = await createContext()
      const projectCampaign = await createActiveCampaign(organization, project)
      const otherProject = await repositories.projectRepository.save(
        projectFactory.transient({ organization }).build(),
      )
      const otherProjectCampaign = await createActiveCampaign(organization, otherProject)
      for (const role of ["tester", "reviewer"] as const) {
        await addCampaignRole({
          organization,
          project,
          campaign: projectCampaign,
          user: addedUser,
          role,
        })
      }
      const keptMembership = await addCampaignRole({
        organization,
        project: otherProject,
        campaign: otherProjectCampaign,
        user: addedUser,
        role: "tester",
      })

      expectResponse(await subject(), 200)

      expect(await findCampaignRows(addedUser.id, projectCampaign.id)).toEqual([])
      expect(
        (await findCampaignRows(addedUser.id, otherProjectCampaign.id)).map(
          (campaignRow) => campaignRow.id,
        ),
      ).toEqual([keptMembership.id])
    })
  })
})
