/** Whether the agent should keep giving the answer, or stop giving it. */
export type TestCaseVerdict = "good" | "bad"

/**
 * How the record's input is built: a standalone question an LLM writes from the whole
 * conversation, or the user's last message as it was sent. A run replays a single turn, so the
 * last message alone can lose what the earlier turns established.
 */
export type TestCaseInputMode = "conversation" | "lastMessage"

/** The agent answer being saved as a test case, and what led to it. */
export type TestCaseSource = {
  agentMessageId: string
  answer: string
  lastUserMessage: string
  /** User turns before the last one. With none, both input modes give the same input. */
  earlierTurnCount: number
  /** The report a user left on this answer, when it is saved from the Feedback page. */
  feedback: string | null
}

/** Where the record goes: an existing dataset, or a new one created on save. */
export type TestCaseDatasetTarget =
  | { kind: "existing"; datasetId: string }
  | { kind: "new"; name: string }

/** What the user settles before anything is drafted. */
export type TestCaseJudgement = {
  verdict: TestCaseVerdict
  /**
   * What makes the answer good or bad, kept with the record so readers of the dataset know why.
   * Required for a bad answer, whose expected output is drafted from it; optional for a good one.
   */
  comment: string
  target: TestCaseDatasetTarget
}

/** The input and expected output proposed for review, then edited by the user. */
export type TestCaseDraft = {
  inputMode: TestCaseInputMode
  input: string
  expectedOutput: string
  anonymized: boolean
}

/** The record about to be saved. */
export type TestCase = TestCaseJudgement & TestCaseDraft
