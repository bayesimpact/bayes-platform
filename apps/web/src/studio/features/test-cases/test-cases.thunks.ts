import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkConfig } from "@/common/store/types"
import type {
  SavedTestCase,
  TestCase,
  TestCaseInputDraft,
  TestCaseInputMode,
} from "./test-cases.models"

function getProjectScope(state: RootState) {
  return {
    organizationId: getCurrentId({ state, name: "organizationId" }),
    projectId: getCurrentId({ state, name: "projectId" }),
  }
}

export const draftTestCaseInput = createAsyncThunk<
  TestCaseInputDraft,
  { agentMessageId: string; inputMode: TestCaseInputMode | null },
  ThunkConfig
>("testCases/draftInput", async (params, { extra: { services }, getState }) =>
  services.testCases.draftInput({ ...getProjectScope(getState()), ...params }),
)

export const draftTestCaseExpectedOutput = createAsyncThunk<
  string,
  { agentMessageId: string; comment: string },
  ThunkConfig
>("testCases/draftExpectedOutput", async (params, { extra: { services }, getState }) =>
  services.testCases.draftExpectedOutput({ ...getProjectScope(getState()), ...params }),
)

export const anonymizeTestCaseText = createAsyncThunk<
  string,
  { agentMessageId: string; text: string },
  ThunkConfig
>("testCases/anonymize", async (params, { extra: { services }, getState }) =>
  services.testCases.anonymize({ ...getProjectScope(getState()), ...params }),
)

export const saveTestCase = createAsyncThunk<
  SavedTestCase,
  { testCase: TestCase; datasetName: string },
  ThunkConfig
>("testCases/save", async ({ testCase }, { extra: { services }, getState }) =>
  services.testCases.createOne({
    ...getProjectScope(getState()),
    target: testCase.target,
    input: testCase.input,
    expectedOutput: testCase.expectedOutput,
    comment: testCase.comment,
  }),
)
