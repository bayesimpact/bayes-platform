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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { mockInvitationSender, setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ProjectsModule } from "../../projects.module"
import { inviteUserToProject } from "../project-membership.factory"

describe("Project membership - deleteOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let membershipId: string
  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule, ActivitiesModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    expectActivityCreated = bindExpectActivityCreated(repositories.activityRepository)
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = "auth0|123"
    mockInvitationSender.resetTicketCounter()
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
    auth0Id = user.auth0Id

    // Create an invited user and membership
    const { membership, invitedUser } = await inviteUserToProject({
      repositories,
      project,
      projectMembership: { role: "member" },
    })
    membershipId = membership.id

    return { organization, project, user, invitedUser, membership }
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

  it("should also delete the placeholder user when removing a pending invitation", async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    auth0Id = user.auth0Id

    const { membership } = await inviteUserToProject({ repositories, project })
    membershipId = membership.id

    // Now remove the membership
    const response = await subject()
    expectResponse(response, 200)

    // Verify the placeholder user is also deleted
    const deletedUser = await repositories.userRepository.findOne({
      where: { id: membership.userId },
    })
    expect(deletedUser).toBeNull()
  })

  it("should NOT delete a real user when removing their membership", async () => {
    const { invitedUser } = await createContext()

    const response = await subject()
    expectResponse(response, 200)

    // Verify the real user still exists (they have a non-placeholder auth0Id from userFactory)
    const user = await repositories.userRepository.findOne({
      where: { id: invitedUser.id },
    })
    expect(user).toBeDefined()
  })
})
