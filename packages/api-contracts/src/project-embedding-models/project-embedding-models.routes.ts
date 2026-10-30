import type { RequestPayload, ResponseData } from "../generic"
import { defineRoute } from "../helpers"
import type {
  EnableProjectEmbeddingModelRequestDto,
  ProjectEmbeddingModelDto,
  UpdateProjectEmbeddingModelRequestDto,
} from "./project-embedding-models.dto"

const BASE_PATH = "organizations/:organizationId/projects/:projectId/embedding-models"

export const ProjectEmbeddingModelsRoutes = {
  getAll: defineRoute<ResponseData<ProjectEmbeddingModelDto[]>>({
    method: "get",
    path: BASE_PATH,
  }),
  /** Enables a model on the project and launches the embedding of its existing chunks. */
  createOne: defineRoute<
    ResponseData<ProjectEmbeddingModelDto>,
    RequestPayload<EnableProjectEmbeddingModelRequestDto>
  >({
    method: "post",
    path: BASE_PATH,
  }),
  updateOne: defineRoute<
    ResponseData<ProjectEmbeddingModelDto>,
    RequestPayload<UpdateProjectEmbeddingModelRequestDto>
  >({
    method: "patch",
    path: `${BASE_PATH}/:projectEmbeddingModelId`,
  }),
}
