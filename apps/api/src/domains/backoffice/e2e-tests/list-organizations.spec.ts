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
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { mockAuth0EmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - list organizations", () => {
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
    const context = await createOrganizationWithProject(repositories, {
      user: { auth0Id, email },
    })
    process.env.BACKOFFICE_AUTHORIZED_DOMAIN = "@example.com"
    process.env.BACKOFFICE_AUTHORIZED_EMAILS = email
    return context
  }

  it("returns default pagination metadata when no params are passed", async () => {
    const { organization } = await createAuthorizedContext()
    const response = await request({
      route: BackofficeRoutes.listOrganizations,
      token: "token",
    })
    expectResponse(response, 200)
    const { organizations, total, page, limit } = response.body.data
    expect(page).toBe(0)
    expect(limit).toBe(10)
    expect(total).toBeGreaterThanOrEqual(1)
    expect(organizations.some((candidate) => candidate.id === organization.id)).toBe(true)
  })

  it("paginates with the requested page and limit", async () => {
    await createAuthorizedContext()
    for (let organizationIndex = 0; organizationIndex < 15; organizationIndex++) {
      await repositories.organizationRepository.save(
        repositories.organizationRepository.create({
          name: `bulk-${organizationIndex}-${randomUUID()}`,
        }),
      )
    }
    const firstPage = await request({
      route: BackofficeRoutes.listOrganizations,
      query: { page: "0", limit: "10" },
      token: "token",
    })
    expectResponse(firstPage, 200)
    expect(firstPage.body.data.organizations).toHaveLength(10)
    expect(firstPage.body.data.total).toBeGreaterThanOrEqual(16)

    const secondPage = await request({
      route: BackofficeRoutes.listOrganizations,
      query: { page: "1", limit: "10" },
      token: "token",
    })
    expectResponse(secondPage, 200)
    expect(secondPage.body.data.organizations.length).toBeGreaterThan(0)
    const firstPageIds = new Set(firstPage.body.data.organizations.map((candidate) => candidate.id))
    for (const candidate of secondPage.body.data.organizations) {
      expect(firstPageIds.has(candidate.id)).toBe(false)
    }
  })

  it("filters by organization name", async () => {
    await createAuthorizedContext()
    const uniqueName = `findme-org-${randomUUID()}`
    const matchingOrganization = await repositories.organizationRepository.save(
      repositories.organizationRepository.create({ name: uniqueName }),
    )

    const response = await request({
      route: BackofficeRoutes.listOrganizations,
      query: { search: "findme-org" },
      token: "token",
    })
    expectResponse(response, 200)
    expect(
      response.body.data.organizations.some(
        (candidate: { id: string }) => candidate.id === matchingOrganization.id,
      ),
    ).toBe(true)
  })
})
