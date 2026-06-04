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
import { removeNullish } from "@/common/utils/remove-nullish"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { Organization } from "../organization.entity"
import { OrganizationsModule } from "../organizations.module"

describe("Organizations - updateOne", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let organizationId: string
  let accessToken: string | undefined = "token"
  let auth0Id = `auth0|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [OrganizationsModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
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

  const createContext = async () => {
    const { organization, user } = await createOrganizationWithOwner(repositories, {
      user: { auth0Id },
    })
    organizationId = organization.id
    return { organization, user }
  }

  const subject = async (payload?: typeof OrganizationsRoutes.updateOrganization.request) =>
    request({
      route: OrganizationsRoutes.updateOrganization,
      pathParams: removeNullish({ organizationId }),
      token: accessToken,
      request: payload,
    })

  it("requires an authentication token", async () => {
    await createContext()
    accessToken = undefined

    expectResponse(
      await subject({ payload: { name: "New Name" } }),
      401,
      AUTH_ERRORS.NO_ACCESS_TOKEN,
    )
  })

  it("rejects a request without an organizationId", async () => {
    await createContext()
    organizationId = null as unknown as string

    expectResponse(
      await subject({ payload: { name: "New Name" } }),
      400,
      AUTH_ERRORS.NO_ORGANIZATION_ID,
    )
  })

  it("rejects a non-member user", async () => {
    const { user: _owner } = await createContext()
    const otherUser = await repositories.userRepository.save({
      id: randomUUID(),
      auth0Id: `auth0|other-${randomUUID()}`,
      email: "other@example.com",
      name: "Other User",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })
    auth0Id = otherUser.auth0Id

    expectResponse(
      await subject({ payload: { name: "New Name" } }),
      401,
      AUTH_ERRORS.NOT_MEMBER_OF_ORG,
    )
  })

  it("rejects a member (non-admin/owner) user", async () => {
    const { organization } = await createContext()
    const { user: memberUser } = await addUserToOrganization({
      repositories,
      organization,
      membership: { role: "member" },
    })
    auth0Id = memberUser.auth0Id

    expectResponse(await subject({ payload: { name: "New Name" } }), 403)
  })

  it("renames the organization and returns success", async () => {
    await createContext()

    const response = await subject({ payload: { name: "Updated Org Name" } })

    expectResponse(response, 200)
    expect(response.body.data.success).toBe(true)

    const organizationRepository = setup.getRepository(Organization)
    const updated = await organizationRepository.findOne({ where: { id: organizationId } })
    expect(updated?.name).toBe("Updated Org Name")
  })

  it("allows an admin to rename the organization", async () => {
    const { organization } = await createContext()
    const { user: adminUser } = await addUserToOrganization({
      repositories,
      organization,
      membership: { role: "admin" },
    })
    auth0Id = adminUser.auth0Id

    const response = await subject({ payload: { name: "Admin Renamed" } })

    expectResponse(response, 200)
    expect(response.body.data.success).toBe(true)
  })

  it("rejects a name shorter than 3 characters", async () => {
    await createContext()

    const response = await subject({ payload: { name: "AB" } })

    expectResponse(response, 400)
  })

  it("trims whitespace from the name", async () => {
    await createContext()

    const response = await subject({ payload: { name: "  Trimmed Name  " } })

    expectResponse(response, 200)

    const organizationRepository = setup.getRepository(Organization)
    const updated = await organizationRepository.findOne({ where: { id: organizationId } })
    expect(updated?.name).toBe("Trimmed Name")
  })
})
