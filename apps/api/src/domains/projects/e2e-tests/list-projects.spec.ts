import { randomUUID } from "node:crypto"
import { DOCUMENT_SOURCE_READ_PERMISSION, ProjectsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { removeNullish } from "@/common/utils/remove-nullish"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { mockForeignAuthSubject, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { addUserToProject } from "../memberships/project-membership.factory"
import { ProjectsModule } from "../projects.module"

describe("Projects - listProjects", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [ProjectsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async () => {
    const { user, organization } = await createOrganizationWithOwner(repositories, {
      user: { authSubject },
    })
    organizationId = organization.id
    return { organization, user }
  }

  const subject = async () =>
    request({
      route: ProjectsRoutes.getAll,
      pathParams: removeNullish({ organizationId }),
      token: accessToken,
    })

  it("should return projects for an organization", async () => {
    const { organization, user } = await createContext()

    const project1 = projectFactory.transient({ organization }).build({ name: "Project 1" })
    const project2 = projectFactory.transient({ organization }).build({ name: "Project 2" })
    await repositories.projectRepository.save([project1, project2])
    await addUserToProject({ repositories, project: project1, user })
    await addUserToProject({ repositories, project: project2, user })

    const response = await subject()

    expectResponse(response, 200)
    const projects = response.body.data
    expect(projects).toHaveLength(2)
    expect(projects.map((project) => project.name)).toContain("Project 1")
    expect(projects.map((project) => project.name)).toContain("Project 2")
    expect(projects[0]).toHaveProperty("id")
    expect(projects[0]).toHaveProperty("createdAt")
    expect(projects[0]).toHaveProperty("updatedAt")
  })

  it("should return empty array when organization has no projects", async () => {
    await createContext()

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })

  it("should return only projects the user (not owner or admin) is a member of", async () => {
    const { organization } = await createContext()

    // create user
    const { user } = await addUserToOrganization({
      repositories,
      organization,
      user: { authSubject: mockForeignAuthSubject() },
    })

    // create projects
    const project1 = projectFactory.transient({ organization }).build({ name: "Project 1" })
    const project2 = projectFactory.transient({ organization }).build({ name: "Project 2" })
    await repositories.projectRepository.save([project1, project2])

    // create project membership
    await addUserToProject({ repositories, project: project2, user })

    // user is the one who will make the request
    authSubject = user.authSubject!

    const response = await subject()

    expectResponse(response, 200)
    const projects = response.body.data
    expect(projects).toHaveLength(1)
    expect(projects.map((project) => project.name)).toContain("Project 2")
  })

  it("should expose admin permissions to project admins and desk access to members", async () => {
    const { organization, user } = await createContext()

    const adminProject = projectFactory.transient({ organization }).build({ name: "Admin" })
    const memberProject = projectFactory.transient({ organization }).build({ name: "Member" })
    await repositories.projectRepository.save([adminProject, memberProject])
    await addUserToProject({
      repositories,
      project: adminProject,
      user,
      membership: { role: "admin" },
    })
    await addUserToProject({
      repositories,
      project: memberProject,
      user,
      membership: { role: "member" },
    })

    const response = await subject()

    expectResponse(response, 200)
    const permissionsByName = Object.fromEntries(
      response.body.data.map((project) => [project.name, project.permissions]),
    )
    expect([...(permissionsByName.Admin ?? [])].sort()).toEqual(
      [
        DOCUMENT_SOURCE_READ_PERMISSION,
        "desk.ui.read",
        "studio.ui.read",
        "evaluation.ui.read",
      ].sort(),
    )
    expect(permissionsByName.Member).toEqual(["desk.ui.read"])
  })
})
