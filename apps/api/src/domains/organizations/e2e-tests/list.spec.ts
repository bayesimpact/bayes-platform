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
import {
  addUserToOrganization,
  organizationMembershipFactory,
  saveOrgMembership,
} from "@/domains/organizations/memberships/organization-membership.factory"
import {
  createOrganizationWithOwner,
  organizationFactory,
} from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { OrganizationsModule } from "../organizations.module"

describe("Organizations - listOrganizations", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [OrganizationsModule, RbacModule],
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

  const subject = async () =>
    request({
      route: OrganizationsRoutes.getAllMine,
      token: accessToken,
    })

  it("requires an authentication token", async () => {
    accessToken = undefined
    expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("returns an empty list when the user has no organizations", async () => {
    const user = userFactory.build({ authSubject })
    await repositories.userRepository.save(user)

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })

  it("returns organizations with RBAC permissions", async () => {
    const { organization } = await createOrganizationWithOwner(repositories, {
      user: { authSubject },
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
      ]),
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
    authSubject = memberUser.authSubject!

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0]).toMatchObject({
      id: organization.id,
      permissions: ["organization.read"],
    })
  })

  it("returns organizations sorted by name, case-insensitively", async () => {
    const { user } = await createOrganizationWithOwner(repositories, {
      user: { authSubject },
      organization: { name: "zebra" },
    })
    const acme = await repositories.organizationRepository.save(
      organizationFactory.build({ name: "Acme" }),
    )
    const northwind = await repositories.organizationRepository.save(
      organizationFactory.build({ name: "Northwind" }),
    )
    await saveOrgMembership({
      repositories,
      membership: organizationMembershipFactory
        .owner()
        .transient({ user, organization: acme })
        .build(),
    })
    await saveOrgMembership({
      repositories,
      membership: organizationMembershipFactory
        .owner()
        .transient({ user, organization: northwind })
        .build(),
    })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data.map((organization) => organization.name)).toEqual([
      "Acme",
      "Northwind",
      "zebra",
    ])
  })

  it("does not expose global organization.create on listed organizations", async () => {
    const user = userFactory.build({ authSubject, email: "superadmin@bayesimpact.org" })
    await repositories.userRepository.save(user)
    await assignPlatformSuperadminToUser({ repositories, user })

    const response = await subject()

    expectResponse(response, 200)
    expect(response.body.data).toEqual([])
  })
})
