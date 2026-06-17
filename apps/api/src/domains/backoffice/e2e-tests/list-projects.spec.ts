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

describe("Backoffice - list projects", () => {
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

  it("lists projects with their organization name", async () => {
    const { project, organization } = await createAuthorizedContext()
    const response = await request({
      route: BackofficeRoutes.listProjects,
      token: "token",
    })
    expectResponse(response, 200)
    const { projects, total, page, limit } = response.body.data
    expect(page).toBe(0)
    expect(limit).toBe(10)
    expect(total).toBeGreaterThanOrEqual(1)
    const returned = projects.find((candidate: { id: string }) => candidate.id === project.id)
    expect(returned).toBeDefined()
    expect(returned?.name).toBe(project.name)
    expect(returned?.organizationId).toBe(organization.id)
    expect(returned?.organizationName).toBe(organization.name)
  })

  it("paginates correctly", async () => {
    const { organization } = await createAuthorizedContext()
    for (let projectIndex = 0; projectIndex < 12; projectIndex++) {
      await repositories.projectRepository.save(
        repositories.projectRepository.create({
          name: `Bulk Project ${projectIndex}-${randomUUID()}`,
          organizationId: organization.id,
        }),
      )
    }
    const firstPage = await request({
      route: BackofficeRoutes.listProjects,
      query: { page: "0", limit: "10" },
      token: "token",
    })
    expectResponse(firstPage, 200)
    expect(firstPage.body.data.projects).toHaveLength(10)
    expect(firstPage.body.data.total).toBeGreaterThanOrEqual(13)
  })

  it("filters by project name", async () => {
    const { organization } = await createAuthorizedContext()
    const uniqueName = `findme-project-${randomUUID()}`
    const matchingProject = await repositories.projectRepository.save(
      repositories.projectRepository.create({ name: uniqueName, organizationId: organization.id }),
    )
    const response = await request({
      route: BackofficeRoutes.listProjects,
      query: { search: "findme-project" },
      token: "token",
    })
    expectResponse(response, 200)
    expect(
      response.body.data.projects.some(
        (listedProject: { id: string }) => listedProject.id === matchingProject.id,
      ),
    ).toBe(true)
  })
})
