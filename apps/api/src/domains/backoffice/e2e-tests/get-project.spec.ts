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

describe("Backoffice - get project", () => {
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

  it("returns the project detail with members and agents", async () => {
    const { project, organization, user, agent } = await createAuthorizedContext()
    const response = await request({
      route: BackofficeRoutes.getProject,
      pathParams: { projectId: project.id },
      token: "token",
    })
    expectResponse(response, 200)
    const returned = response.body.data
    expect(returned.id).toBe(project.id)
    expect(returned.name).toBe(project.name)
    expect(returned.organizationId).toBe(organization.id)
    expect(returned.organizationName).toBe(organization.name)
    expect(returned.members).toEqual([
      {
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        role: "owner",
      },
    ])
    expect(returned.agents).toEqual([
      {
        id: agent.id,
        name: agent.name,
      },
    ])
  })

  it("returns empty members and agents for a project with none", async () => {
    const { organization } = await createAuthorizedContext()
    const emptyProject = await repositories.projectRepository.save(
      repositories.projectRepository.create({
        name: `Empty ${randomUUID()}`,
        organizationId: organization.id,
      }),
    )
    const response = await request({
      route: BackofficeRoutes.getProject,
      pathParams: { projectId: emptyProject.id },
      token: "token",
    })
    expectResponse(response, 200)
    expect(response.body.data.members).toEqual([])
    expect(response.body.data.agents).toEqual([])
  })

  it("returns 404 for an unknown project id", async () => {
    await createAuthorizedContext()
    const response = await request({
      route: BackofficeRoutes.getProject,
      pathParams: { projectId: randomUUID() },
      token: "token",
    })
    expectResponse(response, 404)
  })
})
