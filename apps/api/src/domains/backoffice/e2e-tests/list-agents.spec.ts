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
import { agentFactory } from "@/domains/agents/agent.factory"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { mockAuth0EmailForSub, setupUserGuardForTesting } from "../../../../test/e2e.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { BackofficeModule } from "../backoffice.module"

describe("Backoffice - list agents", () => {
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

  it("returns default pagination metadata when no params are passed", async () => {
    const { agent } = await createAuthorizedContext()
    const response = await request({
      route: BackofficeRoutes.listAgents,
      token: "token",
    })
    expectResponse(response, 200)
    const { agents, total, page, limit } = response.body.data
    expect(page).toBe(0)
    expect(limit).toBe(10)
    expect(total).toBeGreaterThanOrEqual(1)
    expect(agents.some((candidate: { id: string }) => candidate.id === agent.id)).toBe(true)
  })

  it("returns the project name for each agent", async () => {
    const { agent, project } = await createAuthorizedContext()
    const response = await request({
      route: BackofficeRoutes.listAgents,
      token: "token",
    })
    expectResponse(response, 200)
    const returned = response.body.data.agents.find(
      (candidate: { id: string }) => candidate.id === agent.id,
    )
    expect(returned?.projectId).toBe(project.id)
    expect(returned?.projectName).toBe(project.name)
  })

  it("paginates with the requested page and limit", async () => {
    const { project, organization } = await createAuthorizedContext()
    for (let agentIndex = 0; agentIndex < 15; agentIndex++) {
      await repositories.agentRepository.save(
        agentFactory
          .transient({ project, organization })
          .build({ name: `bulk-agent-${agentIndex}-${randomUUID()}` }),
      )
    }
    const firstPage = await request({
      route: BackofficeRoutes.listAgents,
      query: { page: "0", limit: "10" },
      token: "token",
    })
    expectResponse(firstPage, 200)
    expect(firstPage.body.data.agents).toHaveLength(10)

    const secondPage = await request({
      route: BackofficeRoutes.listAgents,
      query: { page: "1", limit: "10" },
      token: "token",
    })
    expectResponse(secondPage, 200)
    expect(secondPage.body.data.agents.length).toBeGreaterThan(0)
    const firstPageIds = new Set(
      firstPage.body.data.agents.map((candidate: { id: string }) => candidate.id),
    )
    for (const candidate of secondPage.body.data.agents) {
      expect(firstPageIds.has(candidate.id)).toBe(false)
    }
  })

  it("filters by agent name", async () => {
    const { project, organization } = await createAuthorizedContext()
    const uniqueName = `findme-agent-${randomUUID()}`
    const matchingAgent = await repositories.agentRepository.save(
      agentFactory.transient({ project, organization }).build({ name: uniqueName }),
    )
    const response = await request({
      route: BackofficeRoutes.listAgents,
      query: { search: "findme-agent" },
      token: "token",
    })
    expectResponse(response, 200)
    expect(
      response.body.data.agents.some(
        (candidate: { id: string }) => candidate.id === matchingAgent.id,
      ),
    ).toBe(true)
  })
})
