import {
  enableProjectEmbeddingModelSchema,
  type ProjectEmbeddingModelDto,
  ProjectEmbeddingModelsRoutes,
  updateProjectEmbeddingModelSchema,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
  UsePipes,
} from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectsService } from "@/domains/projects/projects.service"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { DOCUMENT_READ_PERMISSION, DOCUMENT_UPDATE_PERMISSION } from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { ProjectEmbeddingModel } from "./project-embedding-model.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectEmbeddingModelsService } from "./project-embedding-models.service"

export const EMBEDDING_MODELS_FEATURE_DISABLED_ERROR_MESSAGE =
  "Embedding models are not enabled for this project."

/**
 * Embedding models of a project. Listing them needs the right to see the documents, and changing
 * them the right to update them, since enabling one re-embeds every document of the project.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class ProjectEmbeddingModelsController {
  constructor(
    private readonly projectEmbeddingModelsService: ProjectEmbeddingModelsService,
    private readonly projectsService: ProjectsService,
  ) {}

  @CheckPermission(DOCUMENT_READ_PERMISSION, "project")
  @Get(ProjectEmbeddingModelsRoutes.getAll.path)
  async getAll(
    @Request() req: EndpointRequestWithProject,
  ): Promise<typeof ProjectEmbeddingModelsRoutes.getAll.response> {
    const connectScope = getRequiredConnectScope(req)
    const rows = await this.projectEmbeddingModelsService.list(connectScope)
    return { data: rows.map(toProjectEmbeddingModelDto) }
  }

  @CheckPermission(DOCUMENT_UPDATE_PERMISSION, "project")
  @Post(ProjectEmbeddingModelsRoutes.createOne.path)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(enableProjectEmbeddingModelSchema))
  async createOne(
    @Body() { payload }: typeof ProjectEmbeddingModelsRoutes.createOne.request,
    @Request() req: EndpointRequestWithProject,
  ): Promise<typeof ProjectEmbeddingModelsRoutes.createOne.response> {
    const connectScope = getRequiredConnectScope(req)
    await this.assertFeatureEnabled(connectScope)
    const row = await this.projectEmbeddingModelsService.enable({
      connectScope,
      modelName: payload.modelName,
    })
    return { data: toProjectEmbeddingModelDto(row) }
  }

  @CheckPermission(DOCUMENT_UPDATE_PERMISSION, "project")
  @Patch(ProjectEmbeddingModelsRoutes.updateOne.path)
  async updateOne(
    @Param("projectEmbeddingModelId", new ParseUUIDPipe()) projectEmbeddingModelId: string,
    @Body(new ZodValidationPipe(updateProjectEmbeddingModelSchema))
    _body: typeof ProjectEmbeddingModelsRoutes.updateOne.request,
    @Request() req: EndpointRequestWithProject,
  ): Promise<typeof ProjectEmbeddingModelsRoutes.updateOne.response> {
    const connectScope = getRequiredConnectScope(req)
    await this.assertFeatureEnabled(connectScope)
    const row = await this.projectEmbeddingModelsService.setDefault({
      connectScope,
      projectEmbeddingModelId,
    })
    return { data: toProjectEmbeddingModelDto(row) }
  }

  private async assertFeatureEnabled(
    connectScope: ReturnType<typeof getRequiredConnectScope>,
  ): Promise<void> {
    const hasFeature = await this.projectsService.hasFeature({
      connectScope,
      feature: "embedding-models",
    })
    if (!hasFeature) {
      throw new ForbiddenException(EMBEDDING_MODELS_FEATURE_DISABLED_ERROR_MESSAGE)
    }
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
    isDefault: projectEmbeddingModel.isDefault,
    createdAt: projectEmbeddingModel.createdAt.getTime(),
    updatedAt: projectEmbeddingModel.updatedAt.getTime(),
  }
}
