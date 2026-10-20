import type { RequestPayload, ResponseData } from "../generic"
import { defineRoute } from "../helpers"
import type {
  AnonymizedEvaluationConversationTestCaseTextDto,
  AnonymizeEvaluationConversationTestCaseTextRequestDto,
  CreateEvaluationConversationTestCaseRequestDto,
  DraftEvaluationConversationTestCaseExpectedOutputRequestDto,
  DraftEvaluationConversationTestCaseInputRequestDto,
  EvaluationConversationTestCaseDto,
  EvaluationConversationTestCaseExpectedOutputDraftDto,
  EvaluationConversationTestCaseInputDraftDto,
} from "./evaluation-conversation-test-cases.dto"

const prefix =
  "organizations/:organizationId/projects/:projectId/evaluation-conversation-test-cases"
export const EvaluationConversationTestCasesRoutes = {
  createOne: defineRoute<
    ResponseData<EvaluationConversationTestCaseDto>,
    RequestPayload<CreateEvaluationConversationTestCaseRequestDto>
  >({
    method: "post",
    path: prefix,
  }),
  draftInput: defineRoute<
    ResponseData<EvaluationConversationTestCaseInputDraftDto>,
    RequestPayload<DraftEvaluationConversationTestCaseInputRequestDto>
  >({
    method: "post",
    path: `${prefix}/draft-input`,
  }),
  draftExpectedOutput: defineRoute<
    ResponseData<EvaluationConversationTestCaseExpectedOutputDraftDto>,
    RequestPayload<DraftEvaluationConversationTestCaseExpectedOutputRequestDto>
  >({
    method: "post",
    path: `${prefix}/draft-expected-output`,
  }),
  anonymize: defineRoute<
    ResponseData<AnonymizedEvaluationConversationTestCaseTextDto>,
    RequestPayload<AnonymizeEvaluationConversationTestCaseTextRequestDto>
  >({
    method: "post",
    path: `${prefix}/anonymize`,
  }),
}
