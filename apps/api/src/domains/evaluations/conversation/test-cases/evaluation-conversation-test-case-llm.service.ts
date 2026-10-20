import type { AgentModel } from "@caseai-connect/api-contracts"
import { Inject, Injectable, UnprocessableEntityException } from "@nestjs/common"
import { v4 } from "uuid"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { LLMMetadata, LLMProvider } from "@/common/interfaces/llm-provider.interface"
import { LlmServiceBase } from "@/external/llm"

/** The agent revision that wrote the saved answer. */
export type TestCaseAnsweringRevision = { agentId: string; revision: number; model: AgentModel }

/** A settled turn of the conversation that led to the saved answer. */
export type TestCaseConversationTurn = { role: "user" | "assistant"; content: string }

/** The answer being saved and what led to it, as the prompts show them. */
export type TestCaseAnswerContext = {
  conversation: TestCaseConversationTurn[]
  lastUserMessage: string
  answer: string
}

/** Where the calls run: the model of the agent revision that wrote the answer, in its project. */
type TestCaseLlmScope = {
  agentSettings: TestCaseAnsweringRevision
  agentSessionId: string
  connectScope: RequiredConnectScope
}

const STANDALONE_QUESTION_PROMPT = `You write test cases for a conversational agent. A test sends the agent a single user message, without the conversation that came before it.
Rewrite the user's last message as one standalone message that carries every fact from the earlier turns the agent needs to give the same answer.
Rules:
- Write as the user, in the language and voice of the user's messages.
- Keep the request of the last message, and do not answer it.
- Add only facts stated in the earlier turns, and leave out those the answer does not depend on.
- Return only the message, with no preamble and no quotes.`

const EXPECTED_OUTPUT_PROMPT = `You correct an answer a conversational agent gave. A reviewer says what is wrong with it.
Write the answer the agent should have given.
Rules:
- Fix what the reviewer points out, and keep the rest of the answer: its language, tone, format and correct content.
- Do not mention the reviewer or that the answer was corrected.
- Return only the answer, with no preamble.`

const ANONYMIZE_PROMPT = `You remove personal data from a text before it is saved in a test dataset.
Replace each piece of personal data with a placeholder in square brackets that names its kind, such as [name], [email], [phone], [address], [date of birth] or [identifier].
Rules:
- Keep everything else exactly as written, in the same language.
- Keep facts that identify no one, such as a product, a plan, an amount or a delay.
- Return only the text, with no preamble.`

/**
 * The three LLM calls behind saving an agent answer as a test case. They run on the model of the
 * agent revision that wrote the answer, so the conversation stays with the provider the project
 * chose, and each gets a trace of its own.
 */
@Injectable()
export class EvaluationConversationTestCaseLlmService extends LlmServiceBase {
  constructor(
    @Inject("_MockLLMProvider")
    mockLlmProvider: LLMProvider,
    @Inject("VertexLLMProvider")
    vertexLlmProvider: LLMProvider,
    @Inject("Vertex3LLMProvider")
    vertex3LlmProvider: LLMProvider,
    @Inject("MistralLLMProvider")
    mistralLlmProvider: LLMProvider,
    @Inject("MedGemmaLLMProvider")
    medGemmaLlmProvider: LLMProvider,
    @Inject("GemmaLLMProvider")
    gemmaLlmProvider: LLMProvider,
  ) {
    super({
      mockLlmProvider,
      vertexLlmProvider,
      vertex3LlmProvider,
      medGemmaLlmProvider,
      gemmaLlmProvider,
      mistralLlmProvider,
    })
  }

  /** A message that stands on its own, carrying what the earlier turns established. */
  draftStandaloneQuestion(
    scope: TestCaseLlmScope,
    context: TestCaseAnswerContext,
  ): Promise<string> {
    return this.generate(scope, {
      systemPrompt: STANDALONE_QUESTION_PROMPT,
      prompt: describeAnswerContext(context),
      spanLabel: "test case input",
    })
  }

  /** The answer the agent should have given, from what the reviewer says is wrong. */
  draftExpectedOutput(
    scope: TestCaseLlmScope,
    context: TestCaseAnswerContext,
    comment: string,
  ): Promise<string> {
    return this.generate(scope, {
      systemPrompt: EXPECTED_OUTPUT_PROMPT,
      prompt: `${describeAnswerContext(context)}

<reviewer_comment>
${comment}
</reviewer_comment>`,
      spanLabel: "test case expected output",
    })
  }

  anonymize(scope: TestCaseLlmScope, text: string): Promise<string> {
    return this.generate(scope, {
      systemPrompt: ANONYMIZE_PROMPT,
      prompt: `<text>
${text}
</text>`,
      spanLabel: "test case anonymization",
    })
  }

  private async generate(
    { agentSettings, agentSessionId, connectScope }: TestCaseLlmScope,
    {
      systemPrompt,
      prompt,
      spanLabel,
    }: { systemPrompt: string; prompt: string; spanLabel: string },
  ): Promise<string> {
    const config = this.buildLLMConfig({
      model: agentSettings.model,
      systemPrompt,
      temperature: 0,
      priorityCallsEnabled: false,
      llmFeatures: { priorityCalls: false, flexWorkers: false },
    })
    const metadata: LLMMetadata = {
      traceId: v4(),
      agentSessionId,
      currentTurn: 0,
      agentId: agentSettings.agentId,
      revision: agentSettings.revision,
      projectId: connectScope.projectId,
      organizationId: connectScope.organizationId,
      tags: ["test-case"],
      spanLabel,
    }
    const text = await this.getProviderForModel(config.model).generateText({
      prompt,
      config,
      metadata,
    })
    const draft = text.trim()
    if (!draft) {
      throw new UnprocessableEntityException("The model returned an empty draft")
    }
    return draft
  }
}

function describeAnswerContext({ conversation, lastUserMessage, answer }: TestCaseAnswerContext) {
  const transcript = conversation
    .map((turn) => `${turn.role === "user" ? "User" : "Agent"}: ${turn.content}`)
    .join("\n\n")
  return `<conversation>
${transcript}
</conversation>

<last_user_message>
${lastUserMessage}
</last_user_message>

<agent_answer>
${answer}
</agent_answer>`
}
