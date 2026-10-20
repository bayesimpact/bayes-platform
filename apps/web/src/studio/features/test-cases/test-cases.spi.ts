import type {
  SavedTestCase,
  TestCaseDatasetTarget,
  TestCaseInputDraft,
  TestCaseInputMode,
} from "./test-cases.models"

type ProjectScope = { organizationId: string; projectId: string }

export interface ITestCasesSpi {
  createOne(
    params: ProjectScope & {
      target: TestCaseDatasetTarget
      input: string
      expectedOutput: string
      comment: string
    },
  ): Promise<SavedTestCase>
  /** With no mode, the API picks the conversation when the answer has earlier turns. */
  draftInput(
    params: ProjectScope & { agentMessageId: string; inputMode: TestCaseInputMode | null },
  ): Promise<TestCaseInputDraft>
  draftExpectedOutput(
    params: ProjectScope & { agentMessageId: string; comment: string },
  ): Promise<string>
  anonymize(params: ProjectScope & { agentMessageId: string; text: string }): Promise<string>
}
