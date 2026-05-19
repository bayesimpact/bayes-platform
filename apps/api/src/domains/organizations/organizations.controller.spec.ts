import type { OrganizationDto } from "@caseai-connect/api-contracts"
import { OrganizationsRoutes } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { bindExpectActivityCreated } from "@/common/test/activity-test.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { userFactory } from "@/domains/users/user.factory"
import { setupUserGuardForTesting } from "../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../test/request"
import { Organization } from "./organization.entity"
import { OrganizationsModule } from "./organizations.module"

describe("Organizations - createOrganization", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | undefined = "token"
  let auth0Id = "auth0|123"
  let expectActivityCreated: ReturnType<typeof bindExpectActivityCreated>

  beforeAll(async () => {
    process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN = "@bayesimpact.org"
    setup = await setupE2eTestDatabase({
      additionalImports: [OrganizationsModule],
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
  })

  afterAll(async () => {
    delete process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createContext = async (userParams?: Partial<{ email: string }>) => {
    const user = userFactory.build({
      email: userParams?.email ?? "creator@bayesimpact.org",
    })
    await repositories.userRepository.save(user)
    auth0Id = user.auth0Id
    return { user }
  }

  const subject = async (payload?: typeof OrganizationsRoutes.createOrganization.request) =>
    request({
      route: OrganizationsRoutes.createOrganization,
      token: accessToken,
      request: payload,
    })

  it("requires an authentication token", async () => {
    accessToken = undefined
    expectResponse(await subject(), 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("rejects users without a @bayesimpact.org email", async () => {
    await createContext({ email: "outsider@example.com" })

    const response = await subject({ payload: { name: "Forbidden Org" } })

    expectResponse(response, 403, AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
  })

  it("creates an organization and returns it in correct format", async () => {
    await createContext()

    const response = await subject({ payload: { name: "New Organization" } })

    expectResponse(response, 201)
    expect(response.body.data).toEqual({
      id: expect.any(String),
      name: "New Organization",
      createdAt: expect.any(Number),
      projects: [],
    } satisfies OrganizationDto)
  })

  it("persists the organization in the database", async () => {
    await createContext()

    const response = await subject({ payload: { name: "Persisted Org" } })

    const organization = await setup
      .getRepository(Organization)
      .findOne({ where: { id: response.body.data.id } })
    expect(organization).not.toBeNull()
    expect(organization?.name).toBe("Persisted Org")
  })

  it("makes the creating user an owner of the organization", async () => {
    const { user } = await createContext()

    const response = await subject({ payload: { name: "Owned Org" } })

    const membership = await repositories.organizationMembershipRepository.findOne({
      where: { userId: user.id, organizationId: response.body.data.id },
    })
    expect(membership).not.toBeNull()
    expect(membership?.role).toBe("owner")
  })

  it("tracks an activity for organization creation", async () => {
    await createContext()

    await subject({ payload: { name: "Tracked Org" } })

    await expectActivityCreated("organization.create")
  })

  it("reuses existing user across multiple organization creations", async () => {
    const { user } = await createContext()

    const response1 = await subject({ payload: { name: "First Org" } })
    const response2 = await subject({ payload: { name: "Second Org" } })

    expectResponse(response1, 201)
    expectResponse(response2, 201)
    expect(response1.body.data.id).not.toBe(response2.body.data.id)

    const users = await repositories.userRepository.find({
      where: { auth0Id: user.auth0Id },
    })
    expect(users).toHaveLength(1)
  })

  it("rejects organization name shorter than 3 characters", async () => {
    await createContext()

    const response = await subject({ payload: { name: "AB" } })

    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  it("rejects empty organization name", async () => {
    await createContext()

    const response = await subject({ payload: { name: "" } })

    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  it("accepts organization name with exactly 3 characters", async () => {
    await createContext()

    const response = await subject({ payload: { name: "ABC" } })

    expectResponse(response, 201)
    expect(response.body.data.name).toBe("ABC")
  })
})
