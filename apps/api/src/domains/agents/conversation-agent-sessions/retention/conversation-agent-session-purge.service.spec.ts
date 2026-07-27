import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { agentMessageFeedbackFactory } from "@/domains/agents/shared/agent-session-messages/feedback/agent-message-feedback.factory"
import type { IFileStorage } from "@/domains/documents/storage/file-storage.interface"
import { createOrganizationWithAgentMessage } from "@/domains/organizations/organization.factory"
import { ConversationAgentSessionPurgeService } from "./conversation-agent-session-purge.service"

describe("ConversationAgentSessionPurgeService", () => {
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories
  let service: ConversationAgentSessionPurgeService
  let deletedStoragePaths: string[]

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({})
    repositories = setup.getAllRepositories()
    const fileStorageFake = {
      deleteFile: async (storageRelativePath: string) => {
        deletedStoragePaths.push(storageRelativePath)
      },
    } as unknown as IFileStorage
    service = new ConversationAgentSessionPurgeService(setup.dataSource, fileStorageFake)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    deletedStoragePaths = []
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  const createPurgeableSession = async () => {
    const context = await createOrganizationWithAgentMessage({
      repositories,
      agentType: "conversation",
    })
    const { user, organization, project, agentSession, agentSettings, agentMessage } = context

    await repositories.conversationAgentSessionRepository.update(
      { id: agentSession.id },
      { title: "Sample title", result: { field: "sample value" } },
    )
    await repositories.agentMessageRepository.update(
      { id: agentMessage.id },
      {
        role: "user",
        content: "A user question with personal data",
        toolCalls: [{ id: "tool-1", name: "lookup", arguments: { query: "sample" } }],
      },
    )
    const assistantMessage = agentMessageFactory
      .assistant()
      .transient({ organization, project, session: agentSession, agentSettings })
      .build({ content: "An assistant answer" })
    await repositories.agentMessageRepository.save(assistantMessage)

    const feedback = agentMessageFeedbackFactory
      .transient({ user, organization, project, agentMessage })
      .build({ content: "Free-text feedback" })
    await repositories.agentMessageFeedbackRepository.save(feedback)

    return { ...context, assistantMessage, feedback }
  }

  it("empties content but keeps every row and its metadata", async () => {
    const { agentSession, agentMessage, assistantMessage, feedback } =
      await createPurgeableSession()

    const { purged } = await service.purgeSessionContent(agentSession.id)
    expect(purged).toBe(true)

    const messages = await repositories.agentMessageRepository.find({
      where: { sessionId: agentSession.id },
      order: { createdAt: "ASC" },
    })
    expect(messages.length).toBe(2)
    for (const message of messages) {
      expect(message.content).toBe("")
      expect(message.toolCalls).toBeNull()
    }
    expect(messages.map((message) => message.id).sort()).toEqual(
      [agentMessage.id, assistantMessage.id].sort(),
    )
    expect(messages.some((message) => message.role === "user")).toBe(true)

    const session = await repositories.conversationAgentSessionRepository.findOneByOrFail({
      id: agentSession.id,
    })
    expect(session.title).toBeNull()
    expect(session.result).toBeNull()
    expect(session.purgedAt).not.toBeNull()

    const savedFeedback = await repositories.agentMessageFeedbackRepository.findOneByOrFail({
      id: feedback.id,
    })
    expect(savedFeedback.content).toBe("")
  })

  it("is idempotent: a second run does nothing", async () => {
    const { agentSession } = await createPurgeableSession()
    await service.purgeSessionContent(agentSession.id)
    const secondRun = await service.purgeSessionContent(agentSession.id)
    expect(secondRun.purged).toBe(false)
  })

  it("returns purged false for an unknown session", async () => {
    const { purged } = await service.purgeSessionContent("00000000-0000-0000-0000-000000000000")
    expect(purged).toBe(false)
  })
})
