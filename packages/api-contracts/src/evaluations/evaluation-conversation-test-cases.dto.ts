// A test case is an agent answer saved into a conversation dataset: the input that should lead to
// it, the expected output, and why the answer is good or bad.

/**
 * How the input is built from the conversation that led to the answer: a standalone question an
 * LLM writes from the whole conversation, or the user's last message as it was sent.
 */
export const EVALUATION_CONVERSATION_TEST_CASE_INPUT_MODES = [
  "conversation",
  "lastMessage",
] as const
export type EvaluationConversationTestCaseInputMode =
  (typeof EVALUATION_CONVERSATION_TEST_CASE_INPUT_MODES)[number]

// Request DTOs
export type DraftEvaluationConversationTestCaseInputRequestDto = {
  agentMessageId: string
  /** Null lets the API pick: the conversation when the answer has earlier turns, else the last message. */
  inputMode: EvaluationConversationTestCaseInputMode | null
}

export type DraftEvaluationConversationTestCaseExpectedOutputRequestDto = {
  agentMessageId: string
  /** What is wrong with the answer, which the corrected expected output addresses. */
  comment: string
}

export type AnonymizeEvaluationConversationTestCaseTextRequestDto = {
  /** The answer being saved: its agent's model anonymizes, so the text stays with that provider. */
  agentMessageId: string
  text: string
}

export type CreateEvaluationConversationTestCaseRequestDto = {
  /** An existing dataset of the project, or null to create one named `newDatasetName`. */
  datasetId: string | null
  newDatasetName: string | null
  input: string
  expectedOutput: string
  comment: string | null
}

// Response DTOs
export type EvaluationConversationTestCaseInputDraftDto = {
  inputMode: EvaluationConversationTestCaseInputMode
  input: string
  lastUserMessage: string
  /** User turns before the last one. With none, both input modes give the same input. */
  earlierTurnCount: number
}

export type EvaluationConversationTestCaseExpectedOutputDraftDto = {
  expectedOutput: string
}

export type AnonymizedEvaluationConversationTestCaseTextDto = {
  text: string
}

export type EvaluationConversationTestCaseDto = {
  datasetId: string
  recordId: string
}
