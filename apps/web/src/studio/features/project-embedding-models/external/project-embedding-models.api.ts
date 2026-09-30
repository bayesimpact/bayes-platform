import {
  type ProjectEmbeddingModelDto,
  ProjectEmbeddingModelsRoutes,
} from "@caseai-connect/api-contracts"
import { getAxiosInstance } from "@/external/axios"
import type { ProjectEmbeddingModel } from "../project-embedding-models.models"
import type { IProjectEmbeddingModelsSpi } from "../project-embedding-models.spi"

export default {
  getAll: async ({ organizationId, projectId }) => {
    const axios = getAxiosInstance()
    const response = await axios.get<typeof ProjectEmbeddingModelsRoutes.getAll.response>(
      ProjectEmbeddingModelsRoutes.getAll.getPath({ organizationId, projectId }),
    )
    return response.data.data.map(toProjectEmbeddingModel)
  },
  createOne: async ({ organizationId, projectId, modelName }) => {
    const axios = getAxiosInstance()
    const response = await axios.post<typeof ProjectEmbeddingModelsRoutes.createOne.response>(
      ProjectEmbeddingModelsRoutes.createOne.getPath({ organizationId, projectId }),
      { payload: { modelName } } satisfies typeof ProjectEmbeddingModelsRoutes.createOne.request,
    )
    return toProjectEmbeddingModel(response.data.data)
  },
} satisfies IProjectEmbeddingModelsSpi

const toProjectEmbeddingModel = (dto: ProjectEmbeddingModelDto): ProjectEmbeddingModel => ({
  id: dto.id,
  projectId: dto.projectId,
  modelName: dto.modelName,
  status: dto.status,
  totalChunks: dto.totalChunks,
  processedChunks: dto.processedChunks,
  error: dto.error ?? null,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
})
