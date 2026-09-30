import {
  enableProjectEmbeddingModelSchema,
  type ProjectEmbeddingModelDto,
  ProjectEmbeddingModelsRoutes,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
  UsePipes,
} from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectsService } from "@/domains/projects/projects.service"
import { UserGuard } from "@/domains/users/user.guard"
import { DocumentsGuard } from "../../documents.guard"
import type { ProjectEmbeddingModel } from "./project-embedding-model.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectEmbeddingModelsService } from "./project-embedding-models.service"

export const LOCAL_EMBEDDINGS_FEATURE_DISABLED_ERROR_MESSAGE =
  "Local embeddings are not enabled for this project."

/**
 * Local embedding models of a project. The routes reuse the documents policy: listing and
 * enabling a model is a project admin action, like managing the documents themselves.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, DocumentsGuard)
@RequireContext("organization", "project")
@Controller()
export class ProjectEmbeddingModelsController {
  constructor(
    private readonly projectEmbeddingModelsService: ProjectEmbeddingModelsService,
    private readonly projectsService: ProjectsService,
  ) {}

  @CheckPolicy((policy) => policy.canList())
  @Get(ProjectEmbeddingModelsRoutes.getAll.path)
  async getAll(
    @Request() req: EndpointRequestWithProject,
  ): Promise<typeof ProjectEmbeddingModelsRoutes.getAll.response> {
    const connectScope = getRequiredConnectScope(req)
    const rows = await this.projectEmbeddingModelsService.list(connectScope)
    return { data: rows.map(toProjectEmbeddingModelDto) }
  }

  @CheckPolicy((policy) => policy.canCreate())
  @Post(ProjectEmbeddingModelsRoutes.createOne.path)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(enableProjectEmbeddingModelSchema))
  async createOne(
    @Body() { payload }: typeof ProjectEmbeddingModelsRoutes.createOne.request,
    @Request() req: EndpointRequestWithProject,
  ): Promise<typeof ProjectEmbeddingModelsRoutes.createOne.response> {
    const connectScope = getRequiredConnectScope(req)
    const hasFeature = await this.projectsService.hasFeature({
      connectScope,
      feature: "local-embeddings",
    })
    if (!hasFeature) {
      throw new ForbiddenException(LOCAL_EMBEDDINGS_FEATURE_DISABLED_ERROR_MESSAGE)
    }

    const row = await this.projectEmbeddingModelsService.enable({
      connectScope,
      modelName: payload.modelName,
    })
    return { data: toProjectEmbeddingModelDto(row) }
  }
}

function toProjectEmbeddingModelDto(
  projectEmbeddingModel: ProjectEmbeddingModel,
): ProjectEmbeddingModelDto {
  return {
    id: projectEmbeddingModel.id,
    projectId: projectEmbeddingModel.projectId,
    modelName: projectEmbeddingModel.modelName,
    status: projectEmbeddingModel.status,
    totalChunks: projectEmbeddingModel.totalChunks,
    processedChunks: projectEmbeddingModel.processedChunks,
    error: projectEmbeddingModel.error ?? null,
    createdAt: projectEmbeddingModel.createdAt.getTime(),
    updatedAt: projectEmbeddingModel.updatedAt.getTime(),
  }
}
