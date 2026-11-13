import { clearTestDatabase } from "@/common/test/test-database"
import {
  setupTransactionalTestDatabase,
  teardownTestDatabase,
} from "@/common/test/test-transaction-manager"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import { AgentLlmModule } from "@/domains/agents/shared/agent-session-messages/streaming/agent-llm.module"
import { StreamingModule } from "@/domains/agents/shared/agent-session-messages/streaming/streaming.module"
import { StreamingLlmService } from "@/domains/agents/shared/agent-session-messages/streaming/streaming-llm.service"
import { createOrganizationWithAgent } from "@/domains/organizations/organization.factory"
import { AISDKMockProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mock.provider"
import { LlmModule } from "@/external/llm/llm.module"
import { EvaluationConversationRunLlmService } from "./evaluation-conversation-run-llm.service"

const outputJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    count: { type: "number" },
    enabled: { type: "boolean" },
  },
}

describe("EvaluationConversationRunLlmService", () => {
  let setup: Awaited<ReturnType<typeof setupTransactionalTestDatabase>>
  let service: EvaluationConversationRunLlmService
  let mockProvider: AISDKMockProvider

  beforeAll(async () => {
    setup = await setupTransactionalTestDatabase({
      additionalImports: [StreamingModule, AgentLlmModule, LlmModule],
      providers: [EvaluationConversationRunLlmService],
    })
    service = setup.module.get(EvaluationConversationRunLlmService)
    mockProvider = setup.module.get(AISDKMockProvider)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    mockProvider.resetMock()
  })

  afterAll(async () => {
    await teardownTestDatabase(setup)
  })

  const createContext = async (agentSettingsOverrides: Partial<AgentSettings> = {}) => {
    const context = await createOrganizationWithAgent(setup.getAllRepositories(), {
      agent: { type: "conversation", name: "Helpful Assistant" },
      agentSettings: { fillFormEnabled: true, outputJsonSchema, ...agentSettingsOverrides },
    })
    return {
      ...context,
      connectScope: { organizationId: context.organization.id, projectId: context.project.id },
      userContent: "Please record my request.",
    }
  }

  it("offers the same fillForm schema and form instructions as Studio", async () => {
    const { organization, project, agent, agentSettings, conversationAgentSession } =
      await createOrganizationWithAgent(setup.getAllRepositories(), {
        agent: { type: "conversation" },
        agentSettings: { fillFormEnabled: true, outputJsonSchema },
        withLiveConversationAgentSession: true,
      })
    const connectScope = { organizationId: organization.id, projectId: project.id }
    const userContent = "Please record my request."
    mockProvider.addTextTurn(agent.id, "What is the title?")
    await service.runSingleTurn({ agent, agentSettings, connectScope, userContent })
    const evaluationCall = mockProvider.getCalls().find((call) => call.agentId === agent.id)
    mockProvider.resetMock()

    if (!conversationAgentSession) throw new Error("Expected a Studio session")
    mockProvider.addTextTurn(agent.id, "What is the title?")
    const stream = setup.module.get(StreamingLlmService).streamAgentResponse({
      agentSessionScope: { agent, agentSettings, session: conversationAgentSession, connectScope },
      userContent,
      notifyClient: () => undefined,
    })
    for await (const event of stream) {
      expect(event).toBeDefined()
    }
    const studioCall = mockProvider.getCalls().find((call) => call.agentId === agent.id)
    expect(evaluationCall?.toolNames).toContain("fillForm")
    expect(evaluationCall?.toolSchemas.fillForm).toBe(studioCall?.toolSchemas.fillForm)
    expect(evaluationCall?.prompt).toContain("Recorded with fillForm: nothing yet")
  })

  it("merges partial writes, reads the current form and isolates successive runs", async () => {
    const context = await createContext()
    mockProvider.addToolCallTurn(context.agent.id, "fillForm", { formFields: { title: "Request" } })
    mockProvider.addToolCallTurn(context.agent.id, "fillForm", {
      formFields: { title: null, summary: "Compare options", count: 0, enabled: false },
    })
    mockProvider.addToolCallTurn(context.agent.id, "fillForm", { getFormState: true })
    mockProvider.addTextTurn(context.agent.id, "Recorded.")

    const result = await service.runSingleTurn(context)

    expect(result.output).toBe("Recorded.")
    expect(result.formState).toEqual({
      title: "Request",
      summary: "Compare options",
      count: 0,
      enabled: false,
    })
    expect(mockProvider.getCalls().at(-1)?.prompt).toContain("Compare options")
    const repositories = setup.getAllRepositories()
    expect(await repositories.conversationAgentSessionRepository.count()).toBe(0)
    expect(await repositories.conversationFormRepository.count()).toBe(0)

    mockProvider.addTextTurn(context.agent.id, "What is the title?")
    expect((await service.runSingleTurn(context)).formState).toEqual({})
  })

  it.each([
    { fillFormEnabled: false },
    { outputJsonSchema: null },
  ])("omits fillForm when unavailable: %j", async (agentSettingsOverrides) => {
    const context = await createContext(agentSettingsOverrides)
    mockProvider.addTextTurn(context.agent.id, "Hello.")

    const result = await service.runSingleTurn(context)

    expect(result.formState).toBeNull()
    expect(mockProvider.getCalls()[0]?.toolNames).not.toContain("fillForm")
  })
})
