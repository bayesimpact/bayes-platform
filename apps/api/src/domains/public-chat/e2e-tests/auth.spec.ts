import { randomUUID } from "node:crypto"
import { afterAll } from "@jest/globals"
import type { INestApplication } from "@nestjs/common"
import request from "supertest"
import type { App } from "supertest/types"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { publicAgentSessionFactory } from "../public-agent-sessions/public-agent-session.factory"
import { PublicChatModule } from "../public-chat.module"

describe("PublicChat - Auth", () => {
  let app: INestApplication<App>
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  let embedToken: string | null = randomUUID()
  let sessionId: string | null = randomUUID()
  let sessionToken: string | null = "valid-token"

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [PublicChatModule],
    })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    embedToken = randomUUID()
    sessionId = randomUUID()
    sessionToken = "valid-token"
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
    await app.close()
  })

  const createContext = async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const agent = agentFactory.transient({ organization, project }).build({ embedEnabled: true })
    await repositories.agentRepository.save(agent)

    const knownToken = randomUUID()
    const session = publicAgentSessionFactory.transient({ agent, sessionToken: knownToken }).build()
    await repositories.publicAgentSessionRepository.save(session)

    embedToken = agent.embedToken
    sessionId = session.id
    sessionToken = knownToken

    return { organization, project, agent, session }
  }

  // ──────────────────────────────────────────────────
  // POST /public/agents/:embedToken/sessions
  // ──────────────────────────────────────────────────
  describe("createSession", () => {
    const subject = () =>
      request(app.getHttpServer())
        .post(`/public/agents/${embedToken}/sessions`)
        .set("Connection", "close")
        .send({ payload: {} })

    it("returns 401 when embedToken does not exist", async () => {
      embedToken = randomUUID()
      const response = await subject()
      expect(response.status).toBe(401)
    })

    it("returns 403 when embed access is disabled", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory.transient({ organization, project }).build({ embedEnabled: false })
      await repositories.agentRepository.save(agent)

      embedToken = agent.embedToken
      const response = await subject()
      expect(response.status).toBe(403)
    })

    it("returns 403 when Origin is not in embedAllowedOrigins", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory
        .transient({ organization, project })
        .build({ embedEnabled: true, embedAllowedOrigins: ["https://allowed.example.com"] })
      await repositories.agentRepository.save(agent)

      embedToken = agent.embedToken
      const response = await request(app.getHttpServer())
        .post(`/public/agents/${embedToken}/sessions`)
        .set("Connection", "close")
        .set("Origin", "https://evil.example.com")
        .send({ payload: {} })
      expect(response.status).toBe(403)
    })

    it("returns 201 when Origin matches embedAllowedOrigins", async () => {
      const { organization, project } = await createOrganizationWithProject(repositories)
      const agent = agentFactory
        .transient({ organization, project })
        .build({ embedEnabled: true, embedAllowedOrigins: ["https://allowed.example.com"] })
      await repositories.agentRepository.save(agent)

      embedToken = agent.embedToken
      const response = await request(app.getHttpServer())
        .post(`/public/agents/${embedToken}/sessions`)
        .set("Connection", "close")
        .set("Origin", "https://allowed.example.com")
        .send({ payload: {} })
      expect(response.status).toBe(201)
    })
  })

  // ──────────────────────────────────────────────────
  // GET /public/agents/:embedToken/sessions/:sessionId
  // ──────────────────────────────────────────────────
  describe("getSession", () => {
    const subject = () =>
      request(app.getHttpServer())
        .get(`/public/agents/${embedToken}/sessions/${sessionId}`)
        .set("Connection", "close")
        .set("X-Session-Token", sessionToken ?? "")

    it("returns 401 when embedToken does not exist", async () => {
      await createContext()
      embedToken = randomUUID()
      const response = await subject()
      expect(response.status).toBe(401)
    })

    it("returns 401 when X-Session-Token header is missing", async () => {
      await createContext()
      const response = await request(app.getHttpServer())
        .get(`/public/agents/${embedToken}/sessions/${sessionId}`)
        .set("Connection", "close")
      expect(response.status).toBe(401)
    })

    it("returns 401 when session token is invalid", async () => {
      await createContext()
      sessionToken = "wrong-token"
      const response = await subject()
      expect(response.status).toBe(401)
    })

    it("returns 401 when sessionId belongs to a different agent", async () => {
      await createContext()
      const { organization, project } = await createOrganizationWithProject(repositories)
      const otherAgent = agentFactory
        .transient({ organization, project })
        .build({ embedEnabled: true })
      await repositories.agentRepository.save(otherAgent)

      embedToken = otherAgent.embedToken
      const response = await subject()
      expect(response.status).toBe(401)
    })

    it("returns 200 with valid token", async () => {
      await createContext()
      const response = await subject()
      expect(response.status).toBe(200)
    })
  })
})
