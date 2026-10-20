import type {
  EvaluationConversationTestCaseDto,
  EvaluationConversationTestCaseInputDraftDto,
  EvaluationConversationTestCaseInputMode,
} from "@caseai-connect/api-contracts"
import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMessageRepository } from "@/domains/agents/shared/agent-session-messages/agent-message.repository"
import { isLLMVisibleMessage } from "@/domains/agents/shared/agent-session-messages/streaming/llm-visible-message.helper"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import { AGENT_CONVERSATION_REVIEW_PERMISSION } from "@/domains/rbac/rbac.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationDatasetRepository } from "../datasets/evaluation-conversation-dataset.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationDatasetRecordRepository } from "../datasets/records/evaluation-conversation-dataset-record.repository"
import type {
  TestCaseAnswerContext,
  TestCaseAnsweringRevision,
} from "./evaluation-conversation-test-case-llm.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationTestCaseLlmService } from "./evaluation-conversation-test-case-llm.service"

/** The answer being saved, the conversation that led to it, and where its LLM calls run. */
type SavedAnswer = TestCaseAnswerContext & {
  agentSettings: TestCaseAnsweringRevision
  agentSessionId: string
  /** User turns before the last one. */
  earlierTurnCount: number
}

/** The caller and the answer they start from. */
type AnswerReference = {
  connectScope: RequiredConnectScope
  userId: string
  agentMessageId: string
}

/** A draft, with the session whose conversation it read, for the activity journal. */
type DraftFromConversation<T> = { draft: T; agentSessionId: string }

/**
 * Saves an agent answer as a test case of a conversation dataset: drafts the input that should
 * lead to it and, for a bad answer, the expected output, then writes the record.
 *
 * Drafting reads the conversation behind the answer. The caller's own conversations are open to
 * them; anyone else's only to a safety reviewer of the agent, as on the conversation review page.
 * Each draft names the session it read, so the route can log it as the review page does.
 */
@Injectable()
export class EvaluationConversationTestCasesService {
  constructor(
    private readonly agentMessageRepository: AgentMessageRepository,
    private readonly datasetRepository: EvaluationConversationDatasetRepository,
    private readonly recordRepository: EvaluationConversationDatasetRecordRepository,
    private readonly testCaseLlmService: EvaluationConversationTestCaseLlmService,
    private readonly permissionService: PermissionService,
    private readonly transactionService: TransactionService,
  ) {}

  /**
   * The input in the requested mode, or with none, the conversation when the answer has earlier
   * turns. An answer to the first message has nothing to carry over, so its input is that message.
   */
  async draftInput({
    inputMode,
    ...answerReference
  }: AnswerReference & {
    inputMode: EvaluationConversationTestCaseInputMode | null
  }): Promise<DraftFromConversation<EvaluationConversationTestCaseInputDraftDto>> {
    const { connectScope } = answerReference
    const savedAnswer = await this.loadSavedAnswer(answerReference)
    const { lastUserMessage, earlierTurnCount, agentSessionId } = savedAnswer
    const resolvedMode = earlierTurnCount === 0 ? "lastMessage" : (inputMode ?? "conversation")
    const input =
      resolvedMode === "lastMessage"
        ? lastUserMessage
        : await this.testCaseLlmService.draftStandaloneQuestion(
            toLlmScope(connectScope, savedAnswer),
            savedAnswer,
          )
    return {
      draft: { inputMode: resolvedMode, input, lastUserMessage, earlierTurnCount },
      agentSessionId,
    }
  }

  async draftExpectedOutput({
    comment,
    ...answerReference
  }: AnswerReference & { comment: string }): Promise<DraftFromConversation<string>> {
    if (!comment.trim()) {
      throw new UnprocessableEntityException("Say what is wrong with the answer")
    }
    const savedAnswer = await this.loadSavedAnswer(answerReference)
    const draft = await this.testCaseLlmService.draftExpectedOutput(
      toLlmScope(answerReference.connectScope, savedAnswer),
      savedAnswer,
      comment.trim(),
    )
    return { draft, agentSessionId: savedAnswer.agentSessionId }
  }

  async anonymize({
    text,
    ...answerReference
  }: AnswerReference & { text: string }): Promise<DraftFromConversation<string>> {
    if (!text.trim()) {
      throw new UnprocessableEntityException("The text to anonymize is empty")
    }
    const savedAnswer = await this.loadSavedAnswer(answerReference)
    const draft = await this.testCaseLlmService.anonymize(
      toLlmScope(answerReference.connectScope, savedAnswer),
      text,
    )
    return { draft, agentSessionId: savedAnswer.agentSessionId }
  }

  /** Writes the record, in a new dataset when `datasetId` is null. */
  async createTestCase({
    connectScope,
    datasetId,
    newDatasetName,
    input,
    expectedOutput,
    comment,
  }: {
    connectScope: RequiredConnectScope
    datasetId: string | null
    newDatasetName: string | null
    input: string
    expectedOutput: string
    comment: string | null
  }): Promise<EvaluationConversationTestCaseDto> {
    if (!input.trim()) {
      throw new UnprocessableEntityException("Record input is required")
    }
    if (!expectedOutput.trim()) {
      throw new UnprocessableEntityException("Record expected output is required")
    }
    if (datasetId === null && !newDatasetName?.trim()) {
      throw new UnprocessableEntityException("Dataset name is required")
    }

    return this.transactionService.run(async () => {
      const dataset =
        datasetId === null
          ? await this.datasetRepository.createDataset(connectScope, newDatasetName?.trim() ?? "")
          : await this.datasetRepository.findOne(connectScope, datasetId)
      if (!dataset) {
        throw new NotFoundException(`Evaluation dataset with id ${datasetId} not found`)
      }
      const record = await this.recordRepository.createRecord(connectScope, {
        evaluationConversationDatasetId: dataset.id,
        input,
        expectedOutput,
        comment: comment?.trim() || null,
      })
      return { datasetId: dataset.id, recordId: record.id }
    })
  }

  private async loadSavedAnswer({
    connectScope,
    userId,
    agentMessageId,
  }: AnswerReference): Promise<SavedAnswer> {
    const found = await this.agentMessageRepository.findWithHistory(connectScope, agentMessageId)
    const session = found?.message.conversationAgentSession
    // Someone else's conversation answers like a missing one, so its existence does not leak.
    if (
      !found ||
      !session ||
      found.message.role !== "assistant" ||
      !(await this.canReadConversation({
        userId,
        ownerId: session.userId,
        agentId: session.agentId,
      }))
    ) {
      throw new NotFoundException(`Agent answer with id ${agentMessageId} not found`)
    }
    // A failed, interrupted or purged answer has nothing to keep.
    if (!isLLMVisibleMessage(found.message)) {
      throw new UnprocessableEntityException("This answer has no content to save as a test case")
    }

    const conversation = found.earlierMessages
      .filter(isLLMVisibleMessage)
      .map(({ role, content }) => ({ role, content }))
    const userTurns = conversation.filter((turn) => turn.role === "user")
    const lastUserTurn = userTurns.at(-1)
    if (!lastUserTurn) {
      throw new UnprocessableEntityException("No user message leads to this answer")
    }
    return {
      conversation,
      lastUserMessage: lastUserTurn.content,
      answer: found.message.content,
      agentSettings: {
        agentId: found.message.agentSettings.agentId,
        revision: found.message.agentSettings.revision,
        model: found.message.agentSettings.model,
      },
      agentSessionId: found.message.sessionId,
      earlierTurnCount: userTurns.length - 1,
    }
  }

  private async canReadConversation({
    userId,
    ownerId,
    agentId,
  }: {
    userId: string
    ownerId: string
    agentId: string
  }): Promise<boolean> {
    if (ownerId === userId) return true
    return this.permissionService.has(userId, AGENT_CONVERSATION_REVIEW_PERMISSION, {
      type: "temp_agent",
      id: agentId,
    })
  }
}

function toLlmScope(connectScope: RequiredConnectScope, savedAnswer: SavedAnswer) {
  return {
    agentSettings: savedAnswer.agentSettings,
    agentSessionId: savedAnswer.agentSessionId,
    connectScope,
  }
}
