import { randomUUID } from "node:crypto"
import { BackofficeRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { mockOidcEmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import {
  assignPlatformSuperadminToUser,
  ensureRbacCatalog,
} from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - createOrganization", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [BackofficeModule, RbacModule],
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
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createAuthorizedUser = async () => {
    const email = mockOidcEmailForSub(authSubject)
    const { user } = await createOrganizationWithOwner(repositories, {
      user: { authSubject, email },
    })
    await assignPlatformSuperadminToUser({ repositories, user: user })
    return user
  }

  const subject = async (name: string) =>
    request({
      route: BackofficeRoutes.createOrganization,
      token: "token",
      request: { payload: { name } },
    })

  it("creates an organization and returns its dto", async () => {
    await createAuthorizedUser()
    const response = await subject("Sample Organization")
    expectResponse(response, 201)
    expect(response.body.data.name).toBe("Sample Organization")
    const organization = await repositories.organizationRepository.findOne({
      where: { id: response.body.data.id },
    })
    expect(organization).not.toBeNull()
    expect(organization?.name).toBe("Sample Organization")
  })

  it("makes the acting backoffice user an owner of the created organization", async () => {
    const user = await createAuthorizedUser()
    const response = await subject("Sample Organization")
    expectResponse(response, 201)
    const membership = await repositories.userMembershipRepository.findOne({
      where: {
        userId: user.id,
        resourceId: response.body.data.id,
        resourceType: "organization",
      },
    })
    expect(membership).not.toBeNull()
    expect(membership?.role).toBe("owner")
  })

  it("trims the organization name", async () => {
    await createAuthorizedUser()
    const response = await subject("  Sample Organization  ")
    expectResponse(response, 201)
    expect(response.body.data.name).toBe("Sample Organization")
  })

  it("rejects names shorter than 3 characters", async () => {
    await createAuthorizedUser()
    const response = await subject("ab")
    expectResponse(response, 400)
  })

  it("lists the created organization afterwards", async () => {
    await createAuthorizedUser()
    await subject("Sample Organization")
    const response = await request({
      route: BackofficeRoutes.listOrganizations,
      token: "token",
    })
    expectResponse(response, 200)
    const names = response.body.data.organizations.map(
      (organization: { name: string }) => organization.name,
    )
    expect(names).toContain("Sample Organization")
  })
})
