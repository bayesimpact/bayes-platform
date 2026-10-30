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
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { agentEmbedConfigFactory } from "../../agent-embed-configs/agent-embed-config.factory"
import { PublicChatModule } from "../../public-chat.module"

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
    await app.close()
  })

  const createContext = async (params?: { agentSettings?: Partial<AgentSettings> }) => {
    const { organization, project, agent, agentSettings } = await createOrganizationWithAgent(
      repositories,
      params?.agentSettings ? { agentSettings: params.agentSettings } : {},
    )
    const embedConfig = agentEmbedConfigFactory
      .transient({ organization, project, agent })
      .build({ isEnabled: true })
    await repositories.agentEmbedConfigRepository.save(embedConfig)
    embedToken = embedConfig.embedToken
    return { organization, project, agent, agentSettings, embedConfig }
  }

  const subject = (payload?: { externalVisitorId?: string; variables?: Record<string, string> }) =>
    request(app.getHttpServer())
      .post(`/public/v2/agents/${embedToken}/sessions`)
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

    expect(response.status).toBe(201)
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

    expect(response.status).toBe(201)
    const savedSession = await repositories.publicAgentSessionRepository.findOne({
      where: { id: response.body.data.sessionId },
    })
    expect(savedSession?.externalVisitorId).toBeNull()
  })

  it("greets with the last published revision, not the newer draft (#636)", async () => {
    const { organization, project, agent, agentSettings } = await createContext({
      agentSettings: { greetingMessage: "Published greeting" },
    })
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .draft()
        .transient({ organization, project, agent })
        .build({ revision: agentSettings.revision + 1, greetingMessage: "Draft greeting" }),
    )

    const response = await subject()

    expect(response.status).toBe(201)
    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: response.body.data.sessionId },
    })
    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe("Published greeting")
    expect(messages[0]?.agentSettingsId).toBe(agentSettings.id)
  })

  it("greets with the last non-archived revision (#636)", async () => {
    const { organization, project, agent, agentSettings } = await createContext({
      agentSettings: { greetingMessage: "Published greeting" },
    })
    await repositories.agentSettingsRepository.save(
      agentSettingsFactory
        .archived()
        .transient({ organization, project, agent })
        .build({ revision: agentSettings.revision + 1, greetingMessage: "Archived greeting" }),
    )

    const response = await subject()

    expect(response.status).toBe(201)
    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: response.body.data.sessionId },
    })
    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe("Published greeting")
    expect(messages[0]?.agentSettingsId).toBe(agentSettings.id)
  })

  it("each session call returns a unique sessionToken", async () => {
    await createContext()
    const [response1, response2] = await Promise.all([subject(), subject()])

    expect(response1.status).toBe(201)
    expect(response2.status).toBe(201)
    expect(response1.body.data.sessionToken).not.toBe(response2.body.data.sessionToken)
    expect(response1.body.data.sessionId).not.toBe(response2.body.data.sessionId)
  })

  describe("prompt variables", () => {
    const variableInstructions = "Summarize {{topic}} for {{audience}}"

    const findSavedSession = async (sessionId: string) =>
      repositories.publicAgentSessionRepository.findOne({ where: { id: sessionId } })

    it("refuses the session when a declared variable has no value and no default", async () => {
      await createContext({ agentSettings: { instructions: variableInstructions } })
      const response = await subject()

      expect(response.status).toBe(400)
      expect(response.body).toEqual({
        statusCode: 400,
        message: "Missing prompt variables: topic, audience",
        error: "Bad Request",
        code: "MISSING_PROMPT_VARIABLES",
        missing: ["topic", "audience"],
      })
      expect(await repositories.publicAgentSessionRepository.find()).toHaveLength(0)
    })

    it("stores the values the caller supplies for every declared variable", async () => {
      await createContext({ agentSettings: { instructions: variableInstructions } })
      const response = await subject({
        variables: { topic: "the new pricing page", audience: "support agents" },
      })

      expect(response.status).toBe(201)
      const savedSession = await findSavedSession(response.body.data.sessionId)
      expect(savedSession?.variables).toEqual({
        topic: "the new pricing page",
        audience: "support agents",
      })
    })

    it("falls back to the published settings default when the caller sends no value", async () => {
      await createContext({
        agentSettings: {
          instructions: variableInstructions,
          variables: { topic: "the product tour" },
        },
      })
      const response = await subject({ variables: { audience: "support agents" } })

      expect(response.status).toBe(201)
      const savedSession = await findSavedSession(response.body.data.sessionId)
      expect(savedSession?.variables).toEqual({
        topic: "the product tour",
        audience: "support agents",
      })
    })

    it("lets the caller's value win over the published settings default", async () => {
      await createContext({
        agentSettings: {
          instructions: variableInstructions,
          variables: { topic: "the product tour" },
        },
      })
      const response = await subject({
        variables: { topic: "the refund policy", audience: "support agents" },
      })

      expect(response.status).toBe(201)
      const savedSession = await findSavedSession(response.body.data.sessionId)
      expect(savedSession?.variables).toEqual({
        topic: "the refund policy",
        audience: "support agents",
      })
    })

    it("treats a blank value as missing", async () => {
      await createContext({ agentSettings: { instructions: variableInstructions } })
      const response = await subject({ variables: { topic: "   ", audience: "support agents" } })

      expect(response.status).toBe(400)
      expect(response.body.missing).toEqual(["topic"])
    })

    it("ignores values for variables the instructions do not declare", async () => {
      await createContext({ agentSettings: { instructions: "Summarize {{topic}}" } })
      const response = await subject({ variables: { topic: "the new pricing page", extra: "x" } })

      expect(response.status).toBe(201)
      const savedSession = await findSavedSession(response.body.data.sessionId)
      expect(savedSession?.variables).toEqual({ topic: "the new pricing page" })
    })

    it("stores no variables for an agent that declares none, even if the caller sends some", async () => {
      await createContext()
      const response = await subject({ variables: { topic: "the new pricing page" } })

      expect(response.status).toBe(201)
      const savedSession = await findSavedSession(response.body.data.sessionId)
      expect(savedSession?.variables).toBeNull()
    })
  })
})
