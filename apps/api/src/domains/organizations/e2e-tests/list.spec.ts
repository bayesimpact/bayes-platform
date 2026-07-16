import { randomUUID } from "node:crypto"
import { OrganizationsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { addUserToProject } from "@/domains/projects/memberships/project-membership.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignOrgCreatorToUser,
  ensureOrganizationRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { OrganizationsModule } from "../organizations.module"

describe("Organizations - listOrganizations", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | undefined = "token"
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [OrganizationsModule, RbacModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    await ensureOrganizationRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    auth0Id = `auth0|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const subject = async () =>
    request({
      route: OrganizationsRoutes.listOrganizations,
      token: accessToken,
    })

  it("requires an authentication token", async () => {
    accessToken = undefined
    expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("returns an empty list when the user has no organizations", async () => {
    const user = userFactory.build({ auth0Id })
    await repositories.userRepository.save(user)

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })

  it("returns organizations with RBAC permissions", async () => {
    const { organization } = await createOrganizationWithOwner(repositories, {
      user: { auth0Id },
    })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toHaveLength(1)
    const listedOrganization = response.body.data[0]
    expect(listedOrganization).toMatchObject({
      id: organization.id,
      name: organization.name,
      permissions: expect.arrayContaining([
        "organization.read",
        "organization.update",
        "project.create",
        "project.read",
      ]),
      projects: [],
    })
    expect(listedOrganization?.permissions).not.toContain("organization.create")
  })

  it("returns member organizations with read-only permissions", async () => {
    const { organization } = await createOrganizationWithOwner(repositories)
    const { user: memberUser } = await addUserToOrganization({
      repositories,
      organization,
      membership: { role: "member" },
    })
    auth0Id = memberUser.auth0Id

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0]).toMatchObject({
      id: organization.id,
      permissions: ["organization.read"],
    })
  })

  it("lists all projects for org owners without project membership", async () => {
    const { organization } = await createOrganizationWithOwner(repositories, {
      user: { auth0Id },
    })
    const project = projectFactory.transient({ organization }).build({ name: "Unassigned Project" })
    await repositories.projectRepository.save(project)

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0]?.projects).toEqual([
      expect.objectContaining({
        id: project.id,
        name: "Unassigned Project",
        featureFlags: [],
      }),
    ])
  })

  it("includes projects the user can access via project membership", async () => {
    const { user, organization } = await createOrganizationWithOwner(repositories, {
      user: { auth0Id },
    })
    const project = projectFactory.transient({ organization }).build({ name: "Listed Project" })
    await repositories.projectRepository.save(project)
    await addUserToProject({ repositories, project, user })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toHaveLength(1)
    const listedOrganization = response.body.data[0]
    expect(listedOrganization?.projects).toHaveLength(1)
    expect(listedOrganization?.projects[0]).toMatchObject({
      id: project.id,
      name: "Listed Project",
      featureFlags: [],
    })
  })

  it("lists only invited projects for org members", async () => {
    const { organization } = await createOrganizationWithOwner(repositories)
    const invitedProject = projectFactory
      .transient({ organization })
      .build({ name: "Invited Project" })
    const otherProject = projectFactory.transient({ organization }).build({ name: "Other Project" })
    await repositories.projectRepository.save([invitedProject, otherProject])

    const { user: memberUser } = await addUserToOrganization({
      repositories,
      organization,
      membership: { role: "member" },
    })
    await addUserToProject({ repositories, project: invitedProject, user: memberUser })
    auth0Id = memberUser.auth0Id

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0]?.permissions).toEqual(["organization.read"])
    expect(response.body.data[0]?.projects).toEqual([
      expect.objectContaining({ id: invitedProject.id, name: "Invited Project" }),
    ])
  })

  it("does not expose global organization.create on listed organizations", async () => {
    const user = userFactory.build({ auth0Id, email: "creator@bayesimpact.org" })
    await repositories.userRepository.save(user)
    await assignOrgCreatorToUser({ repositories, user })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })
})
