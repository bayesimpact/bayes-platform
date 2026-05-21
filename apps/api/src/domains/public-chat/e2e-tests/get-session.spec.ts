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

describe("PublicChat - getSession", () => {
  let app: INestApplication<App>
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  let embedToken: string
  let sessionId: string
  let sessionToken: string

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
    sessionToken = randomUUID()
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

  const subject = () =>
    request(app.getHttpServer())
      .get(`/public/agents/${embedToken}/sessions/${sessionId}`)
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)

  it("should return session with empty messages for a fresh session", async () => {
    await createContext()
    const response = await subject()

    expect(response.status).toBe(200)
    expect(response.body.data.id).toBe(sessionId)
    expect(response.body.data.messages).toEqual([])
    expect(response.body.data.agentId).toBeDefined()
    expect(response.body.data.createdAt).toBeDefined()
  })

  it("should create a session via the endpoint and then retrieve it", async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const agent = agentFactory.transient({ organization, project }).build({ embedEnabled: true })
    await repositories.agentRepository.save(agent)
    embedToken = agent.embedToken

    const createResponse = await request(app.getHttpServer())
      .post(`/public/agents/${embedToken}/sessions`)
      .set("Connection", "close")
      .send({ payload: {} })
    expect(createResponse.status).toBe(201)

    sessionId = createResponse.body.data.sessionId
    sessionToken = createResponse.body.data.sessionToken

    const getResponse = await subject()
    expect(getResponse.status).toBe(200)
    expect(getResponse.body.data.id).toBe(sessionId)
  })

  it("should return messages in chronological order when they exist", async () => {
    const { agent } = await createContext()

    const connectScope = {
      organizationId: agent.organizationId,
      projectId: agent.projectId,
    }

    await repositories.agentMessageRepository.save({
      id: randomUUID(),
      sessionId,
      ...connectScope,
      role: "user" as const,
      content: "Hello",
      status: null,
      startedAt: null,
      completedAt: null,
      toolCalls: null,
      documentId: null,
      attachmentDocumentId: null,
      createdAt: new Date("2026-01-01T10:00:00Z"),
      updatedAt: new Date("2026-01-01T10:00:00Z"),
      deletedAt: null,
    })
    await repositories.agentMessageRepository.save({
      id: randomUUID(),
      sessionId,
      ...connectScope,
      role: "assistant" as const,
      content: "Hi there!",
      status: "completed" as const,
      startedAt: new Date("2026-01-01T10:00:01Z"),
      completedAt: new Date("2026-01-01T10:00:02Z"),
      toolCalls: null,
      documentId: null,
      attachmentDocumentId: null,
      createdAt: new Date("2026-01-01T10:00:01Z"),
      updatedAt: new Date("2026-01-01T10:00:02Z"),
      deletedAt: null,
    })

    const response = await subject()
    expect(response.status).toBe(200)
    expect(response.body.data.messages).toHaveLength(2)
    expect(response.body.data.messages[0].role).toBe("user")
    expect(response.body.data.messages[0].content).toBe("Hello")
    expect(response.body.data.messages[1].role).toBe("assistant")
    expect(response.body.data.messages[1].content).toBe("Hi there!")
    expect(response.body.data.messages[1].status).toBe("completed")
  })
})
