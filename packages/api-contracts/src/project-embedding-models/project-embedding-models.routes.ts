import type { RequestPayload, ResponseData } from "../generic"
import { defineRoute } from "../helpers"
import type {
  EnableProjectEmbeddingModelRequestDto,
  ProjectEmbeddingModelDto,
} from "./project-embedding-models.dto"

const BASE_PATH = "organizations/:organizationId/projects/:projectId/embedding-models"

export const ProjectEmbeddingModelsRoutes = {
  getAll: defineRoute<ResponseData<ProjectEmbeddingModelDto[]>>({
    method: "get",
    path: BASE_PATH,
  }),
  /** Enables a local model on the project and launches the re-embedding of its chunks. */
  createOne: defineRoute<
    ResponseData<ProjectEmbeddingModelDto>,
    RequestPayload<EnableProjectEmbeddingModelRequestDto>
  >({
    method: "post",
    path: BASE_PATH,
  }),
}
