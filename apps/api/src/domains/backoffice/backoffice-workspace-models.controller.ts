import {
  BACKOFFICE_PROJECT_MODEL_UPDATE_PERMISSION,
  BackofficeRoutes,
  createBackofficeCustomModelSchema,
  resetBackofficeProjectModelSchema,
  setBackofficeProjectModelSchema,
  updateBackofficeCustomModelSchema,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { LLM_PROVIDERS, type LlmProviders } from "@/external/llm/llm.module"
import type {
  CustomModelView,
  ProjectModelView,
} from "@/external/llm/workspace-models/workspace-models.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { WorkspaceModelsService } from "@/external/llm/workspace-models/workspace-models.service"
import { BackofficeGuard } from "./backoffice.guard"

type ProjectModelsResponse = typeof BackofficeRoutes.listProjectModels.response
type CustomModelsResponse = typeof BackofficeRoutes.listCustomModels.response

/**
 * The two lists of models of a workspace (a project): the models of the code it offers, and the
 * models it adds on servers of its own. Superadmin only, as such a server receives the
 * conversations of the agents that use it. Only these routes ever send a server URL.
 */
@UseGuards(JwtAuthGuard, UserGuard, BackofficeGuard, CheckPermissionGuard)
@Controller()
export class BackofficeWorkspaceModelsController {
  constructor(
    private readonly workspaceModelsService: WorkspaceModelsService,
    @Inject(LLM_PROVIDERS) private readonly llmProviders: LlmProviders,
  ) {}

  @Get(BackofficeRoutes.listProjectModels.path)
  @CheckPermission(BACKOFFICE_PROJECT_MODEL_UPDATE_PERMISSION)
  async listProjectModels(
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<ProjectModelsResponse> {
    await this.assertProjectExists(projectId)
    return this.projectModels(projectId)
  }

  @Put(BackofficeRoutes.setProjectModel.path)
  @CheckPermission(BACKOFFICE_PROJECT_MODEL_UPDATE_PERMISSION)
  @TrackActivity({ action: "backoffice.project_model.update" })
  async setProjectModel(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(setBackofficeProjectModelSchema))
    body: typeof BackofficeRoutes.setProjectModel.request,
  ): Promise<ProjectModelsResponse> {
    await this.assertProjectExists(projectId)
    await this.workspaceModelsService.setProjectModel({ projectId, ...body.payload })
    return this.projectModels(projectId)
  }

  @Post(BackofficeRoutes.resetProjectModel.path)
  @CheckPermission(BACKOFFICE_PROJECT_MODEL_UPDATE_PERMISSION)
  @TrackActivity({ action: "backoffice.project_model.reset" })
  async resetProjectModel(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(resetBackofficeProjectModelSchema))
    body: typeof BackofficeRoutes.resetProjectModel.request,
  ): Promise<ProjectModelsResponse> {
    await this.assertProjectExists(projectId)
    await this.workspaceModelsService.resetProjectModel({ projectId, model: body.payload.model })
    return this.projectModels(projectId)
  }

  @Get(BackofficeRoutes.listCustomModels.path)
  @CheckPermission(BACKOFFICE_PROJECT_MODEL_UPDATE_PERMISSION)
  async listCustomModels(
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<CustomModelsResponse> {
    await this.assertProjectExists(projectId)
    return this.customModels(projectId)
  }

  @Post(BackofficeRoutes.createCustomModel.path)
  @CheckPermission(BACKOFFICE_PROJECT_MODEL_UPDATE_PERMISSION)
  @TrackActivity({ action: "backoffice.custom_model.create" })
  async createCustomModel(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(createBackofficeCustomModelSchema))
    body: typeof BackofficeRoutes.createCustomModel.request,
  ): Promise<CustomModelsResponse> {
    await this.assertProjectExists(projectId)
    const { baseModel, ...input } = body.payload
    await this.workspaceModelsService.createCustomModel({ projectId, baseModel, input })
    return this.customModels(projectId)
  }

  @Patch(BackofficeRoutes.updateCustomModel.path)
  @CheckPermission(BACKOFFICE_PROJECT_MODEL_UPDATE_PERMISSION)
  @TrackActivity({ action: "backoffice.custom_model.update" })
  async updateCustomModel(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("customModelId", ParseUUIDPipe) customModelId: string,
    @Body(new ZodValidationPipe(updateBackofficeCustomModelSchema))
    body: typeof BackofficeRoutes.updateCustomModel.request,
  ): Promise<CustomModelsResponse> {
    await this.assertProjectExists(projectId)
    await this.workspaceModelsService.updateCustomModel({
      projectId,
      id: customModelId,
      input: body.payload,
    })
    return this.customModels(projectId)
  }

  @Delete(BackofficeRoutes.deleteCustomModel.path)
  @CheckPermission(BACKOFFICE_PROJECT_MODEL_UPDATE_PERMISSION)
  @TrackActivity({ action: "backoffice.custom_model.delete" })
  async deleteCustomModel(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("customModelId", ParseUUIDPipe) customModelId: string,
  ): Promise<CustomModelsResponse> {
    await this.assertProjectExists(projectId)
    await this.workspaceModelsService.deleteCustomModel({ projectId, id: customModelId })
    return this.customModels(projectId)
  }

  private async projectModels(projectId: string): Promise<ProjectModelsResponse> {
    const models = await this.workspaceModelsService.listProjectModels(projectId)
    return {
      data: {
        models: models.map((view) => {
          const modelInfos = this.llmProviders[view.provider].getModelInfos(view.model)
          return {
            ...toProjectModelDto(view),
            deprecation: modelInfos.deprecation ?? null,
            servedOutsideEu: modelInfos.servedOutsideEu === true,
          }
        }),
      },
    }
  }

  private async customModels(projectId: string): Promise<CustomModelsResponse> {
    const customModels = await this.workspaceModelsService.listCustomModels(projectId)
    return {
      data: {
        customModels: customModels.map(toCustomModelDto),
        types: this.workspaceModelsService.listCustomModelTypes(),
      },
    }
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    if (!(await this.workspaceModelsService.projectExists(projectId)))
      throw new NotFoundException(`Project ${projectId} not found`)
  }
}

function toProjectModelDto(view: ProjectModelView) {
  return {
    model: view.model,
    provider: view.provider,
    selfHosted: view.selfHosted,
    enabled: view.enabled,
    customized: view.customized,
  }
}

function toCustomModelDto(view: CustomModelView) {
  return {
    id: view.id,
    name: view.name,
    baseModel: view.baseModel,
    provider: view.provider,
    baseUrl: view.baseUrl,
    hasApiKey: view.hasApiKey,
    servedModelName: view.servedModelName,
    agentCount: view.agentCount,
    createdAt: view.createdAt.getTime(),
  }
}
