import {
  type EvaluationConversationDatasetDto,
  EvaluationConversationDatasetsRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { EvaluationConversationDataset } from "../evaluation-conversation-datasets.models"
import type { IEvaluationConversationDatasetsSpi } from "../evaluation-conversation-datasets.spi"

export default {
  getAll: async (params) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof EvaluationConversationDatasetsRoutes.getAll.response>(
      EvaluationConversationDatasetsRoutes.getAll.getPath(params),
    )
    return response.data.data.map(toDataset)
  },
} satisfies IEvaluationConversationDatasetsSpi

function toDataset(dto: EvaluationConversationDatasetDto): EvaluationConversationDataset {
  return {
    createdAt: dto.createdAt,
    id: dto.id,
    name: dto.name,
    projectId: dto.projectId,
    recordCount: dto.recordCount,
    updatedAt: dto.updatedAt,
  }
}
