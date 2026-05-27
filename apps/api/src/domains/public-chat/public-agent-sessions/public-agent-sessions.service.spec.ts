import crypto, { randomUUID } from "node:crypto"
import { afterAll } from "@jest/globals"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentFactory } from "@/domains/agents/agent.factory"
import { createOrganizationWithProject } from "@/domains/organizations/organization.factory"
import { sdk } from "@/external/llm/open-telemetry-init"
import { agentEmbedConfigFactory } from "../agent-embed-configs/agent-embed-config.factory"
import { PublicChatModule } from "../public-chat.module"
import { publicAgentSessionFactory } from "./public-agent-session.factory"
import { PublicAgentSessionsService } from "./public-agent-sessions.service"

describe("PublicAgentSessionsService", () => {
  let service: PublicAgentSessionsService
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [PublicChatModule],
    })
    repositories = setup.getAllRepositories()
    service = setup.module.get(PublicAgentSessionsService)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await sdk.shutdown()
  })

  const buildEmbedConfig = async () => {
    const { organization, project } = await createOrganizationWithProject(repositories)
    const agent = agentFactory.transient({ organization, project }).build()
    await repositories.agentRepository.save(agent)
    const embedConfig = agentEmbedConfigFactory
      .transient({ organization, project, agent })
      .build({ isEnabled: true })
    await repositories.agentEmbedConfigRepository.save(embedConfig)
    return { organization, project, agent, embedConfig }
  }

  describe("createSession", () => {
    it("should create a session and return a plaintext session token", async () => {
      const { embedConfig } = await buildEmbedConfig()
      const { session, sessionToken } = await service.createSession(embedConfig)

      expect(session.id).toBeDefined()
      expect(sessionToken).toBeDefined()
      expect(typeof sessionToken).toBe("string")
      expect(sessionToken).toHaveLength(36) // UUID format
    })

    it("should store the SHA-256 hash of the token, not the plaintext", async () => {
      const { embedConfig } = await buildEmbedConfig()
      const { session, sessionToken } = await service.createSession(embedConfig)

      const expectedHash = crypto.createHash("sha256").update(sessionToken).digest("hex")
      expect(session.sessionTokenHash).toBe(expectedHash)
      expect(session.sessionTokenHash).not.toBe(sessionToken)
    })

    it("should copy organizationId, projectId, and agentId from the embed config", async () => {
      const { embedConfig } = await buildEmbedConfig()
      const { session } = await service.createSession(embedConfig)

      expect(session.organizationId).toBe(embedConfig.organizationId)
      expect(session.projectId).toBe(embedConfig.projectId)
      expect(session.agentId).toBe(embedConfig.agentId)
      expect(session.embedConfigId).toBe(embedConfig.id)
    })

    it("should store externalVisitorId when provided", async () => {
      const { embedConfig } = await buildEmbedConfig()
      const visitorId = "browser-fp-xyz"
      const { session } = await service.createSession(embedConfig, visitorId)

      expect(session.externalVisitorId).toBe(visitorId)
    })

    it("should set externalVisitorId to null when not provided", async () => {
      const { embedConfig } = await buildEmbedConfig()
      const { session } = await service.createSession(embedConfig)

      expect(session.externalVisitorId).toBeNull()
    })

    it("should set lastActivityAt", async () => {
      const { embedConfig } = await buildEmbedConfig()
      const before = new Date()
      const { session } = await service.createSession(embedConfig)
      const after = new Date()

      expect(session.lastActivityAt).not.toBeNull()
      expect(session.lastActivityAt!.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(session.lastActivityAt!.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it("each call produces a unique token and session", async () => {
      const { embedConfig } = await buildEmbedConfig()
      const result1 = await service.createSession(embedConfig)
      const result2 = await service.createSession(embedConfig)

      expect(result1.sessionToken).not.toBe(result2.sessionToken)
      expect(result1.session.id).not.toBe(result2.session.id)
      expect(result1.session.sessionTokenHash).not.toBe(result2.session.sessionTokenHash)
    })
  })

  describe("findByTokenHash", () => {
    it("should find a session by its SHA-256 token hash", async () => {
      const { embedConfig } = await buildEmbedConfig()
      const plainToken = randomUUID()
      const session = publicAgentSessionFactory
        .transient({ embedConfig, sessionToken: plainToken })
        .build()
      await repositories.publicAgentSessionRepository.save(session)

      const hash = crypto.createHash("sha256").update(plainToken).digest("hex")
      const found = await service.findByTokenHash(hash)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(session.id)
    })

    it("should return null when hash does not match any session", async () => {
      const hash = crypto.createHash("sha256").update("nonexistent").digest("hex")
      const found = await service.findByTokenHash(hash)
      expect(found).toBeNull()
    })
  })

  describe("getSessionWithMessages", () => {
    it("should return the session with an empty messages array for a new session", async () => {
      const { embedConfig } = await buildEmbedConfig()
      const { session } = await service.createSession(embedConfig)

      const result = await service.getSessionWithMessages(session.id)

      expect(result.session.id).toBe(session.id)
      expect(result.messages).toHaveLength(0)
    })

    it("should return messages belonging to the session in chronological order", async () => {
      const { embedConfig } = await buildEmbedConfig()
      const { session } = await service.createSession(embedConfig)

      const connectScope = {
        organizationId: embedConfig.organizationId,
        projectId: embedConfig.projectId,
      }
      await repositories.agentMessageRepository.save({
        id: randomUUID(),
        sessionId: session.id,
        ...connectScope,
        role: "user" as const,
        content: "First message",
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
        sessionId: session.id,
        ...connectScope,
        role: "assistant" as const,
        content: "Response",
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

      const result = await service.getSessionWithMessages(session.id)

      expect(result.messages).toHaveLength(2)
      expect(result.messages[0]?.content).toBe("First message")
      expect(result.messages[1]?.content).toBe("Response")
    })

    it("should mark streaming messages older than 5 minutes as aborted", async () => {
      const { embedConfig } = await buildEmbedConfig()
      const { session } = await service.createSession(embedConfig)

      const connectScope = {
        organizationId: embedConfig.organizationId,
        projectId: embedConfig.projectId,
      }
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000)
      const stuckMessageId = randomUUID()
      await repositories.agentMessageRepository.save({
        id: stuckMessageId,
        sessionId: session.id,
        ...connectScope,
        role: "assistant" as const,
        content: "",
        status: "streaming" as const,
        startedAt: sixMinutesAgo,
        completedAt: null,
        toolCalls: null,
        documentId: null,
        attachmentDocumentId: null,
        createdAt: sixMinutesAgo,
        updatedAt: sixMinutesAgo,
        deletedAt: null,
      })

      await service.getSessionWithMessages(session.id)

      const recovered = await repositories.agentMessageRepository.findOne({
        where: { id: stuckMessageId },
      })
      expect(recovered?.status).toBe("aborted")
    })

    it("should not mark recent streaming messages as aborted", async () => {
      const { embedConfig } = await buildEmbedConfig()
      const { session } = await service.createSession(embedConfig)

      const connectScope = {
        organizationId: embedConfig.organizationId,
        projectId: embedConfig.projectId,
      }
      const recentMessageId = randomUUID()
      await repositories.agentMessageRepository.save({
        id: recentMessageId,
        sessionId: session.id,
        ...connectScope,
        role: "assistant" as const,
        content: "",
        status: "streaming" as const,
        startedAt: new Date(),
        completedAt: null,
        toolCalls: null,
        documentId: null,
        attachmentDocumentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })

      await service.getSessionWithMessages(session.id)

      const notRecovered = await repositories.agentMessageRepository.findOne({
        where: { id: recentMessageId },
      })
      expect(notRecovered?.status).toBe("streaming")
    })
  })

  describe("updateLastActivity", () => {
    it("should update lastActivityAt to the current time", async () => {
      const { embedConfig } = await buildEmbedConfig()
      const { session } = await service.createSession(embedConfig)

      const before = new Date()
      await service.updateLastActivity(session.id)
      const after = new Date()

      const updated = await repositories.publicAgentSessionRepository.findOne({
        where: { id: session.id },
      })
      expect(updated?.lastActivityAt?.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(updated?.lastActivityAt?.getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })
})
