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
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
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
})
