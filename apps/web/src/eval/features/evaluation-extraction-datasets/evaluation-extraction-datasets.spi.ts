import type {
  EvaluationExtractionDatasetSchemaColumnDto,
  SuccessResponseDTO,
} from "@caseai-connect/api-contracts"
import type {
  EvaluationExtractionDataset,
  EvaluationExtractionDatasetFile,
  EvaluationExtractionDatasetFileColumn,
  PaginatedEvaluationExtractionDatasetRecords,
} from "./evaluation-extraction-datasets.models"

type BaseParams = { organizationId: string; projectId: string }
export interface IEvaluationExtractionDatasetsSpi {
  getAllFiles(params: BaseParams): Promise<EvaluationExtractionDatasetFile[]>
  getAll(params: BaseParams): Promise<EvaluationExtractionDataset[]>
  getRecords(
    params: BaseParams & {
      datasetId: string
      page?: number
      limit?: number
      columnFilters?: Record<string, string>
      sortBy?: string
      sortOrder?: "asc" | "desc"
    },
  ): Promise<PaginatedEvaluationExtractionDatasetRecords>
  createOne(params: BaseParams & { payload: { name: string } }): Promise<SuccessResponseDTO>
  renameOne(
    params: BaseParams & { datasetId: string } & { payload: { name: string } },
  ): Promise<SuccessResponseDTO>
  updateOne(
    params: BaseParams & { datasetId: string; documentId: string } & {
      payload: {
        name: string
        columns: EvaluationExtractionDatasetSchemaColumnDto[]
      }
    },
  ): Promise<SuccessResponseDTO>
  getFileColumns(
    params: BaseParams & { documentId: string },
  ): Promise<EvaluationExtractionDatasetFileColumn[]>
}
