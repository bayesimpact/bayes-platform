import { EvaluationConversationTestCasesRoutes } from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { ITestCasesSpi } from "../test-cases.spi"

export default {
  createOne: async ({ organizationId, projectId, target, input, expectedOutput, comment }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof EvaluationConversationTestCasesRoutes.createOne.response
    >(EvaluationConversationTestCasesRoutes.createOne.getPath({ organizationId, projectId }), {
      payload: {
        datasetId: target.kind === "existing" ? target.datasetId : null,
        newDatasetName: target.kind === "new" ? target.name : null,
        input,
        expectedOutput,
        comment: comment.trim() || null,
      },
    } satisfies typeof EvaluationConversationTestCasesRoutes.createOne.request)
    return response.data.data
  },
  draftInput: async ({ organizationId, projectId, agentMessageId, inputMode }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof EvaluationConversationTestCasesRoutes.draftInput.response
    >(EvaluationConversationTestCasesRoutes.draftInput.getPath({ organizationId, projectId }), {
      payload: { agentMessageId, inputMode },
    } satisfies typeof EvaluationConversationTestCasesRoutes.draftInput.request)
    return response.data.data
  },
  draftExpectedOutput: async ({ organizationId, projectId, agentMessageId, comment }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof EvaluationConversationTestCasesRoutes.draftExpectedOutput.response
    >(
      EvaluationConversationTestCasesRoutes.draftExpectedOutput.getPath({
        organizationId,
        projectId,
      }),
      {
        payload: { agentMessageId, comment },
      } satisfies typeof EvaluationConversationTestCasesRoutes.draftExpectedOutput.request,
    )
    return response.data.data.expectedOutput
  },
  anonymize: async ({ organizationId, projectId, agentMessageId, text }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<
      typeof EvaluationConversationTestCasesRoutes.anonymize.response
    >(EvaluationConversationTestCasesRoutes.anonymize.getPath({ organizationId, projectId }), {
      payload: { agentMessageId, text },
    } satisfies typeof EvaluationConversationTestCasesRoutes.anonymize.request)
    return response.data.data.text
  },
} satisfies ITestCasesSpi
