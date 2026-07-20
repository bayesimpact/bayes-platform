import type { SuccessResponseDTO } from "@caseai-connect/api-contracts"
import type {
  EvaluationConversationDataset,
  PaginatedEvaluationConversationDatasetRecords,
} from "./evaluation-conversation-datasets.models"

type BaseParams = { organizationId: string; projectId: string }
export interface IEvaluationConversationDatasetsSpi {
  getAll(params: BaseParams): Promise<EvaluationConversationDataset[]>
  getRecords(
    params: BaseParams & {
      datasetId: string
      page?: number
      limit?: number
    },
  ): Promise<PaginatedEvaluationConversationDatasetRecords>
  createOne(params: BaseParams & { payload: { name: string } }): Promise<SuccessResponseDTO>
  renameOne(
    params: BaseParams & { datasetId: string } & { payload: { name: string } },
  ): Promise<SuccessResponseDTO>
  deleteOne(params: BaseParams & { datasetId: string }): Promise<void>
  createRecord(
    params: BaseParams & { datasetId: string } & {
      payload: { input: string; expectedOutput: string }
    },
  ): Promise<SuccessResponseDTO>
  updateRecord(
    params: BaseParams & { datasetId: string; recordId: string } & {
      payload: { input: string; expectedOutput: string }
    },
  ): Promise<SuccessResponseDTO>
  deleteRecord(params: BaseParams & { datasetId: string; recordId: string }): Promise<void>
}
