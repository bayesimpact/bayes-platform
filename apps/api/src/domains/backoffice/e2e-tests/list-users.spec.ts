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
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { mockAuth0EmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - list users", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let auth0Id = `auth0|${randomUUID()}`

  const originalAuthorizedEmails = process.env.BACKOFFICE_AUTHORIZED_EMAILS
  const originalAuthorizedDomain = process.env.BACKOFFICE_AUTHORIZED_DOMAIN

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [BackofficeModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => auth0Id),
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    auth0Id = `auth0|${randomUUID()}`
    delete process.env.BACKOFFICE_AUTHORIZED_DOMAIN
    delete process.env.BACKOFFICE_AUTHORIZED_EMAILS
  })

  afterEach(() => {
    if (originalAuthorizedEmails === undefined) {
      delete process.env.BACKOFFICE_AUTHORIZED_EMAILS
    } else {
      process.env.BACKOFFICE_AUTHORIZED_EMAILS = originalAuthorizedEmails
    }
    if (originalAuthorizedDomain === undefined) {
      delete process.env.BACKOFFICE_AUTHORIZED_DOMAIN
    } else {
      process.env.BACKOFFICE_AUTHORIZED_DOMAIN = originalAuthorizedDomain
    }
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const createAuthorizedContext = async () => {
    const email = mockAuth0EmailForSub(auth0Id)
    const context = await createOrganizationWithAgent(repositories, {
      user: { auth0Id, email },
    })
    process.env.BACKOFFICE_AUTHORIZED_DOMAIN = "@example.com"
    process.env.BACKOFFICE_AUTHORIZED_EMAILS = email
    return context
  }

  it("lists users with their organization and project memberships", async () => {
    const { user, organization, project } = await createAuthorizedContext()
    const response = await request({
      route: BackofficeRoutes.listUsers,
      token: "token",
    })
    expectResponse(response, 200)
    const { users, total, page, limit } = response.body.data
    expect(page).toBe(0)
    expect(limit).toBe(10)
    expect(total).toBeGreaterThanOrEqual(1)
    const returned = users.find((candidate) => candidate.id === user.id)
    expect(returned).toBeDefined()
    expect(returned?.email).toBe(user.email)
    expect(returned?.organizationMemberships).toEqual([
      {
        organizationId: organization.id,
        organizationName: organization.name,
        role: "owner",
      },
    ])
    expect(returned?.projectMemberships).toEqual([
      {
        projectId: project.id,
        projectName: project.name,
        role: "owner",
      },
    ])
  })

  it("returns an empty memberships list for users with no relationships", async () => {
    await createAuthorizedContext()
    const email = `no-membership-${randomUUID()}@example.com`
    const createdUser = await repositories.userRepository.save(
      repositories.userRepository.create({
        auth0Id: `auth0|${randomUUID()}`,
        email,
        name: null,
        pictureUrl: null,
      }),
    )
    const response = await request({
      route: BackofficeRoutes.listUsers,
      token: "token",
    })
    expectResponse(response, 200)
    const returned = response.body.data.users.find((candidate) => candidate.id === createdUser.id)
    expect(returned).toBeDefined()
    expect(returned?.organizationMemberships).toEqual([])
    expect(returned?.projectMemberships).toEqual([])
  })

  it("paginates with the requested page and limit", async () => {
    await createAuthorizedContext()
    for (let userIndex = 0; userIndex < 15; userIndex++) {
      await repositories.userRepository.save(
        repositories.userRepository.create({
          auth0Id: `auth0|${randomUUID()}`,
          email: `bulk-${userIndex}-${randomUUID()}@example.com`,
          name: null,
          pictureUrl: null,
        }),
      )
    }
    const firstPage = await request({
      route: BackofficeRoutes.listUsers,
      query: { page: "0", limit: "10" },
      token: "token",
    })
    expectResponse(firstPage, 200)
    expect(firstPage.body.data.users).toHaveLength(10)
    expect(firstPage.body.data.total).toBeGreaterThanOrEqual(16)

    const secondPage = await request({
      route: BackofficeRoutes.listUsers,
      query: { page: "1", limit: "10" },
      token: "token",
    })
    expectResponse(secondPage, 200)
    expect(secondPage.body.data.users.length).toBeGreaterThan(0)
    const firstPageIds = new Set(firstPage.body.data.users.map((listedUser) => listedUser.id))
    for (const listedUser of secondPage.body.data.users) {
      expect(firstPageIds.has(listedUser.id)).toBe(false)
    }
  })

  it("filters by search across email, name, and membership names", async () => {
    await createAuthorizedContext()
    const matchingEmail = `findme-${randomUUID()}@example.com`
    const matchingUser = await repositories.userRepository.save(
      repositories.userRepository.create({
        auth0Id: `auth0|${randomUUID()}`,
        email: matchingEmail,
        name: null,
        pictureUrl: null,
      }),
    )

    const response = await request({
      route: BackofficeRoutes.listUsers,
      query: { search: "findme" },
      token: "token",
    })
    expectResponse(response, 200)
    expect(response.body.data.users.length).toBeGreaterThanOrEqual(1)
    expect(response.body.data.users.some((listedUser) => listedUser.id === matchingUser.id)).toBe(
      true,
    )
  })
})
