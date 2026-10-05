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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { PROJECT_ROLE_PERMISSIONS } from "@/domains/rbac/rbac.constants"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../../test/request"
import { ProjectsModule } from "../../projects.module"
import { addUserToProject } from "../project-membership.factory"

describe("Project membership - getAll", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let projectId: string
  let accessToken: string | undefined = "token"
  let authSubject = "oidc|123"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    repositories = setup.getAllRepositories()
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

  const createContext = async () => {
    const { user, organization, project } = await createOrganizationWithProject(repositories)
    organizationId = organization.id
    projectId = project.id
    authSubject = user.authSubject!
    return { organization, project, user }
  }

  const subject = async () =>
    request({
      route: ProjectMembershipRoutes.getAll,
      pathParams: removeNullish({ organizationId, projectId }),
      token: accessToken,
    })

  it("should return memberships with user name and email", async () => {
    const { user } = await createContext()

    const response = await subject()

    expectResponse(response, 200)
    const memberships = response.body.data
    expect(memberships).toHaveLength(1)
    expect(memberships[0]!.userName).toBe(user.name)
    expect(memberships[0]!.userEmail).toBe(user.email)
    expect(memberships[0]!).toHaveProperty("id")
    expect(memberships[0]!).toHaveProperty("projectId")
    expect(memberships[0]!).toHaveProperty("userId")
    expect(memberships[0]!).toHaveProperty("createdAt")
  })

  it("should return every member with the permissions of their role", async () => {
    const { project } = await createContext()
    const { user: admin } = await addUserToProject({
      repositories,
      project,
      membership: { role: "admin" },
    })
    const { user: member } = await addUserToProject({
      repositories,
      project,
      membership: { role: "member" },
    })

    const response = await subject()

    expectResponse(response, 200)
    const memberships = response.body.data
    expect(memberships.map((membership) => membership.role).sort()).toEqual([
      "admin",
      "member",
      "owner",
    ])

    const adminMembership = memberships.find((membership) => membership.userId === admin.id)
    expect(adminMembership?.roleKey).toBe("project_admin")
    expect([...(adminMembership?.permissions ?? [])].sort()).toEqual(
      [...PROJECT_ROLE_PERMISSIONS.project_admin].sort(),
    )

    const memberMembership = memberships.find((membership) => membership.userId === member.id)
    expect(memberMembership?.roleKey).toBe("project_member")
    expect([...(memberMembership?.permissions ?? [])].sort()).toEqual(
      [...PROJECT_ROLE_PERMISSIONS.project_member].sort(),
    )
  })
})
