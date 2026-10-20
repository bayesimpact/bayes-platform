import { afterAll, beforeAll, beforeEach } from "@jest/globals"
import { NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { grantConversationReview } from "@/domains/agents/conversation-reviewers/agent-conversation-reviewer.factory"
import type { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { AgentMessageRepository } from "@/domains/agents/shared/agent-session-messages/agent-message.repository"
import { agentMessageFactory } from "@/domains/agents/shared/agent-session-messages/agent-messages.factory"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import { createOrganizationWithAgentSession } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { AISDKMockProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mock.provider"
import { LlmModule } from "@/external/llm/llm.module"
import { EvaluationConversationDatasetRepository } from "../datasets/evaluation-conversation-dataset.repository"
import { EvaluationConversationDatasetRecordRepository } from "../datasets/records/evaluation-conversation-dataset-record.repository"
import { EvaluationConversationTestCaseLlmService } from "./evaluation-conversation-test-case-llm.service"
import { EvaluationConversationTestCasesService } from "./evaluation-conversation-test-cases.service"

describe("EvaluationConversationTestCasesService", () => {
  let service: EvaluationConversationTestCasesService
  let mockProvider: AISDKMockProvider
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [LlmModule, RbacModule],
      providers: [
        AgentMessageRepository,
        EvaluationConversationDatasetRecordRepository,
        EvaluationConversationDatasetRepository,
        EvaluationConversationTestCaseLlmService,
        EvaluationConversationTestCasesService,
      ],
    })
    repositories = setup.getAllRepositories()
    service = setup.module.get(EvaluationConversationTestCasesService)
    mockProvider = setup.module.get(AISDKMockProvider)
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    mockProvider.resetMock()
  })

  /**
   * Saves the messages a second apart, in order, in a session of the organization owner, and
   * returns the last one with the scope.
   */
  const seedSession = async (messages: Pick<AgentMessage, "role" | "content" | "status">[]) => {
    const { organization, project, user, agent, agentSession, agentSettings } =
      await createOrganizationWithAgentSession({ repositories, agentType: "conversation" })
    const startedAt = Date.now()
    const saved = messages.map((fields, index) =>
      agentMessageFactory
        .transient({ organization, project, session: agentSession, agentSettings })
        .build({ ...fields, createdAt: new Date(startedAt + index * 1000) }),
    )
    await repositories.agentMessageRepository.save(saved)
    const connectScope: RequiredConnectScope = {
      organizationId: organization.id,
      projectId: project.id,
    }
    return { organization, user, agent, connectScope, answer: saved.at(-1)! }
  }

  it("shows the model settled user and agent turns only, and counts user turns", async () => {
    const { user, agent, connectScope, answer } = await seedSession([
      { role: "user", content: "I bought the annual Pro plan on March 3.", status: null },
      { role: "assistant", content: "Provider error 500", status: "error" },
      { role: "tool", content: '{"plan":"pro"}', status: null },
      { role: "assistant", content: "Thanks. What can I do for you?", status: "completed" },
      { role: "user", content: "Can I switch to the monthly plan?", status: null },
      { role: "assistant", content: "Let me hand you to billing.", status: "completed" },
      { role: "assistant", content: "Yes, from Settings › Billing.", status: "completed" },
    ])
    mockProvider.addTextTurn(agent.id, "On the annual Pro plan since March 3, can I switch?")

    const { draft } = await service.draftInput({
      connectScope,
      userId: user.id,
      agentMessageId: answer.id,
      inputMode: null,
    })

    expect(draft).toEqual({
      inputMode: "conversation",
      input: "On the annual Pro plan since March 3, can I switch?",
      lastUserMessage: "Can I switch to the monthly plan?",
      earlierTurnCount: 1,
    })
    const [call] = mockProvider.getCalls()
    expect(call?.prompt).toContain("Agent: Let me hand you to billing.")
    expect(call?.prompt).not.toContain("Provider error 500")
    expect(call?.prompt).not.toContain('{\\"plan\\":\\"pro\\"}')
  })

  it("rejects an answer whose session was purged", async () => {
    const { user, connectScope, answer } = await seedSession([
      { role: "user", content: "", status: null },
      { role: "assistant", content: "", status: "completed" },
    ])

    await expect(
      service.draftInput({
        connectScope,
        userId: user.id,
        agentMessageId: answer.id,
        inputMode: null,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException)
  })

  it("rejects an answer no user message leads to", async () => {
    const { user, connectScope, answer } = await seedSession([
      { role: "assistant", content: "Hello, how can I help?", status: "completed" },
    ])

    await expect(
      service.draftInput({
        connectScope,
        userId: user.id,
        agentMessageId: answer.id,
        inputMode: null,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException)
  })

  it("opens someone else's conversation only to a safety reviewer of the agent", async () => {
    const { organization, agent, connectScope, answer } = await seedSession([
      { role: "user", content: "Can I switch to the monthly plan?", status: null },
      { role: "assistant", content: "Yes, from Settings › Billing.", status: "completed" },
    ])
    const { user: colleague } = await addUserToOrganization({ repositories, organization })
    const draftAsColleague = () =>
      service.draftInput({
        connectScope,
        userId: colleague.id,
        agentMessageId: answer.id,
        inputMode: "lastMessage",
      })

    await expect(draftAsColleague()).rejects.toBeInstanceOf(NotFoundException)

    await grantConversationReview({ repositories, user: colleague, agent })
    await expect(draftAsColleague()).resolves.toMatchObject({
      draft: { input: "Can I switch to the monthly plan?" },
    })
  })
})
