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
import { PublicChatModule } from "../public-chat.module"

describe("PublicChat - createSession", () => {
  let app: INestApplication<App>
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  let embedToken: string

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
    embedToken = agent.embedToken
    return { organization, project, agent }
  }

  const subject = (payload?: { externalVisitorId?: string }) =>
    request(app.getHttpServer())
      .post(`/public/agents/${embedToken}/sessions`)
      .set("Connection", "close")
      .send({ payload: payload ?? {} })

  it("should create a session and return sessionId + sessionToken", async () => {
    await createContext()
    const response = await subject()

    expect(response.status).toBe(201)
    expect(response.body.data.sessionId).toBeDefined()
    expect(response.body.data.sessionToken).toBeDefined()
    expect(typeof response.body.data.sessionId).toBe("string")
    expect(typeof response.body.data.sessionToken).toBe("string")
  })

  it("should persist the session in the database", async () => {
    await createContext()
    const response = await subject()

    expect(response.status).toBe(201)
    const { sessionId } = response.body.data

    const savedSession = await repositories.publicAgentSessionRepository.findOne({
      where: { id: sessionId },
    })
    expect(savedSession).not.toBeNull()
    expect(savedSession?.agentId).toBeDefined()
    expect(savedSession?.sessionTokenHash).toBeDefined()
    expect(savedSession?.lastActivityAt).not.toBeNull()
  })

  it("should store the token as a hash (not plaintext)", async () => {
    await createContext()
    const response = await subject()

    const { sessionId, sessionToken } = response.body.data
    const savedSession = await repositories.publicAgentSessionRepository.findOne({
      where: { id: sessionId },
    })

    expect(savedSession?.sessionTokenHash).not.toBe(sessionToken)
    expect(savedSession?.sessionTokenHash).toHaveLength(64) // SHA-256 hex = 64 chars
  })

  it("should store externalVisitorId when provided", async () => {
    await createContext()
    const externalVisitorId = "browser-fingerprint-abc123"
    const response = await subject({ externalVisitorId })

    expect(response.status).toBe(201)
    const savedSession = await repositories.publicAgentSessionRepository.findOne({
      where: { id: response.body.data.sessionId },
    })
    expect(savedSession?.externalVisitorId).toBe(externalVisitorId)
  })

  it("should set externalVisitorId to null when not provided", async () => {
    await createContext()
    const response = await subject()

    const savedSession = await repositories.publicAgentSessionRepository.findOne({
      where: { id: response.body.data.sessionId },
    })
    expect(savedSession?.externalVisitorId).toBeNull()
  })

  it("each session call returns a unique sessionToken", async () => {
    await createContext()
    const [response1, response2] = await Promise.all([subject(), subject()])

    expect(response1.body.data.sessionToken).not.toBe(response2.body.data.sessionToken)
    expect(response1.body.data.sessionId).not.toBe(response2.body.data.sessionId)
  })
})
