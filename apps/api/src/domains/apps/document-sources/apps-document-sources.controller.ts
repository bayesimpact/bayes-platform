import {
  AppsDocumentSourcesRoutes,
  createDocumentSourceSchema,
  DOCUMENT_SOURCE_CREATE_PERMISSION,
  DOCUMENT_SOURCE_DELETE_PERMISSION,
  DOCUMENT_SOURCE_READ_PERMISSION,
  DOCUMENT_SOURCE_UPDATE_PERMISSION,
  type DocumentSourceDto,
  updateDocumentSourceSchema,
} from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentSourcesService } from "@/domains/documents/sources/document-sources.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "@/domains/projects/project.repository"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { AppGuard } from "../app.guard"

type AppRequest = EndpointRequest & { appProjectId: string }

@Controller()
@UseGuards(AppGuard, CheckPermissionGuard)
export class AppsDocumentSourcesController {
  constructor(
    private readonly documentSourcesService: DocumentSourcesService,
    private readonly projectRepository: ProjectRepository,
  ) {}

  @CheckPermission(DOCUMENT_SOURCE_READ_PERMISSION, "project")
  @Get(AppsDocumentSourcesRoutes.getAll.path)
  async getAll(
    @Param("projectId") projectId: string,
    @Query("external_id") externalId: string | undefined,
    @Req() request: AppRequest,
  ): Promise<typeof AppsDocumentSourcesRoutes.getAll.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    const documentSources = await this.documentSourcesService.getAll(connectScope, {
      externalId: externalId?.trim() || undefined,
    })
    return { data: documentSources.map(toDocumentSourceDto) }
  }

  @CheckPermission(DOCUMENT_SOURCE_READ_PERMISSION, "project")
  @Get(AppsDocumentSourcesRoutes.getOne.path)
  async getOne(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Req() request: AppRequest,
  ): Promise<typeof AppsDocumentSourcesRoutes.getOne.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    const documentSource = await this.documentSourcesService.getOne(connectScope, id)
    if (!documentSource) {
      throw new NotFoundException(`Document source ${id} not found`)
    }
    return { data: toDocumentSourceDto(documentSource) }
  }

  @CheckPermission(DOCUMENT_SOURCE_CREATE_PERMISSION, "project")
  @Post(AppsDocumentSourcesRoutes.createOne.path)
  @HttpCode(HttpStatus.CREATED)
  async createOne(
    @Param("projectId") projectId: string,
    @Req() request: AppRequest,
    @Body() body: unknown,
  ): Promise<typeof AppsDocumentSourcesRoutes.createOne.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    const parsed = createDocumentSourceSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException("Invalid document source payload")
    }

    const documentSource = await this.documentSourcesService.createOne(connectScope, {
      name: parsed.data.name,
      type: parsed.data.type ?? null,
      externalId: parsed.data.external_id ?? null,
      baseUrl: parsed.data.base_url ?? null,
      config: parsed.data.config ?? null,
    })
    return { data: toDocumentSourceDto(documentSource) }
  }

  @CheckPermission(DOCUMENT_SOURCE_UPDATE_PERMISSION, "project")
  @Patch(AppsDocumentSourcesRoutes.updateOne.path)
  async updateOne(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Req() request: AppRequest,
    @Body() body: unknown,
  ): Promise<typeof AppsDocumentSourcesRoutes.updateOne.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    const parsed = updateDocumentSourceSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException("Invalid document source payload")
    }

    const documentSource = await this.documentSourcesService.updateOne(connectScope, id, {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.config !== undefined ? { config: parsed.data.config } : {}),
    })
    return { data: toDocumentSourceDto(documentSource) }
  }

  @CheckPermission(DOCUMENT_SOURCE_DELETE_PERMISSION, "project")
  @Delete(AppsDocumentSourcesRoutes.deleteOne.path)
  @HttpCode(HttpStatus.OK)
  async deleteOne(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Req() request: AppRequest,
  ): Promise<typeof AppsDocumentSourcesRoutes.deleteOne.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    await this.documentSourcesService.deleteOne(connectScope, id)
    return { data: { success: true } }
  }

  private async connectScopeFor(
    projectId: string,
    request: AppRequest,
  ): Promise<RequiredConnectScope> {
    if (projectId !== request.appProjectId) {
      throw new ForbiddenException("Project does not match the access token")
    }

    const [project] = await this.projectRepository.findPickerProjectsByIds([projectId])
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`)
    }

    return { organizationId: project.organizationId, projectId: project.id }
  }
}

function toDocumentSourceDto(documentSource: {
  id: string
  name: string
  type: string | null
  externalId: string | null
  baseUrl: string | null
  createdAt: Date
  updatedAt: Date
}): DocumentSourceDto {
  return {
    id: documentSource.id,
    name: documentSource.name,
    type: documentSource.type,
    externalId: documentSource.externalId,
    baseUrl: documentSource.baseUrl,
    createdAt: documentSource.createdAt.getTime(),
    updatedAt: documentSource.updatedAt.getTime(),
  }
}
