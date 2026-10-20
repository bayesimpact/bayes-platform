import { AgentModel } from "@caseai-connect/api-contracts"
import { UnprocessableEntityException } from "@nestjs/common"
import type { LLMProvider } from "@/common/interfaces/llm-provider.interface"
import { agentFactory } from "@/domains/agents/agent.factory"
import { agentSettingsFactory } from "@/domains/agents/settings/agent.settings.factory"
import { organizationFactory } from "@/domains/organizations/organization.factory"
import { projectFactory } from "@/domains/projects/project.factory"
import {
  EvaluationConversationTestCaseLlmService,
  type TestCaseAnswerContext,
} from "./evaluation-conversation-test-case-llm.service"

describe("EvaluationConversationTestCaseLlmService", () => {
  const organization = organizationFactory.build()
  const project = projectFactory.transient({ organization }).build()
  const agent = agentFactory.transient({ organization, project }).build()
  const connectScope = { organizationId: organization.id, projectId: project.id }
  const context: TestCaseAnswerContext = {
    conversation: [
      { role: "user", content: "I bought the annual Pro plan on March 3." },
      { role: "assistant", content: "What can I do for you?" },
      { role: "user", content: "Can I switch to the monthly plan?" },
    ],
    lastUserMessage: "Can I switch to the monthly plan?",
    answer: "Yes, the unused part is refunded to your card.",
  }

  let service: EvaluationConversationTestCaseLlmService
  let mockProvider: { generateText: jest.Mock }
  let vertexProvider: { generateText: jest.Mock }
  let mistralProvider: { generateText: jest.Mock }

  beforeEach(() => {
    mockProvider = { generateText: jest.fn() }
    vertexProvider = { generateText: jest.fn() }
    mistralProvider = { generateText: jest.fn() }
    service = new EvaluationConversationTestCaseLlmService(
      mockProvider as unknown as LLMProvider,
      vertexProvider as unknown as LLMProvider,
      vertexProvider as unknown as LLMProvider,
      mistralProvider as unknown as LLMProvider,
      vertexProvider as unknown as LLMProvider,
      vertexProvider as unknown as LLMProvider,
    )
  })

  const scopeFor = (model: AgentModel) => ({
    agentSettings: agentSettingsFactory
      .transient({ organization, project, agent })
      .build({ model }),
    agentSessionId: "session-1",
    connectScope,
  })

  it("runs on the model of the agent revision that wrote the answer", async () => {
    mistralProvider.generateText.mockResolvedValue("A standalone question")

    await service.draftStandaloneQuestion(scopeFor(AgentModel.MistralSmall31_24B), context)

    expect(mistralProvider.generateText).toHaveBeenCalledTimes(1)
    expect(vertexProvider.generateText).not.toHaveBeenCalled()
    const [{ config, metadata }] = mistralProvider.generateText.mock.calls[0]
    expect(config).toMatchObject({ model: AgentModel.MistralSmall31_24B, temperature: 0 })
    expect(metadata).toMatchObject({
      agentId: agent.id,
      agentSessionId: "session-1",
      organizationId: organization.id,
      projectId: project.id,
      tags: ["test-case"],
    })
  })

  it("shows the conversation, the answer and the comment to the model", async () => {
    mockProvider.generateText.mockResolvedValue("Yes, as store credit.")

    await service.draftExpectedOutput(
      scopeFor(AgentModel._Mock),
      context,
      "A plan switch gives store credit.",
    )

    const [{ prompt }] = mockProvider.generateText.mock.calls[0]
    expect(prompt).toContain("User: I bought the annual Pro plan on March 3.")
    expect(prompt).toContain("Agent: What can I do for you?")
    expect(prompt).toContain("<agent_answer>\nYes, the unused part is refunded to your card.")
    expect(prompt).toContain("<reviewer_comment>\nA plan switch gives store credit.")
  })

  it("trims the draft", async () => {
    mockProvider.generateText.mockResolvedValue("  I am [name].\n")

    await expect(service.anonymize(scopeFor(AgentModel._Mock), "I am Jordan.")).resolves.toBe(
      "I am [name].",
    )
  })

  it("rejects an empty draft", async () => {
    mockProvider.generateText.mockResolvedValue(" \n")

    await expect(
      service.draftStandaloneQuestion(scopeFor(AgentModel._Mock), context),
    ).rejects.toBeInstanceOf(UnprocessableEntityException)
  })
})
