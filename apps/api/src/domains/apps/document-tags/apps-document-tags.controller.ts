import {
  type AppDocumentTagDto,
  AppsDocumentTagsRoutes,
  createAppDocumentTagSchema,
  DOCUMENT_TAG_CREATE_PERMISSION,
  DOCUMENT_TAG_DELETE_PERMISSION,
  DOCUMENT_TAG_READ_PERMISSION,
  DOCUMENT_TAG_UPDATE_PERMISSION,
  updateAppDocumentTagSchema,
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
  Req,
  UseGuards,
} from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { attachTrackedActivity } from "@/domains/activities/attach-tracked-activity"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagsService } from "@/domains/documents/tags/document-tags.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "@/domains/projects/project.repository"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { AppGuard } from "../app.guard"

type AppRequest = EndpointRequest & { appProjectId: string }

@Controller()
@UseGuards(AppGuard, CheckPermissionGuard)
export class AppsDocumentTagsController {
  constructor(
    private readonly documentTagsService: DocumentTagsService,
    private readonly projectRepository: ProjectRepository,
  ) {}

  @CheckPermission(DOCUMENT_TAG_READ_PERMISSION, "project")
  @Get(AppsDocumentTagsRoutes.getAll.path)
  async getAll(
    @Param("projectId") projectId: string,
    @Req() request: AppRequest,
  ): Promise<typeof AppsDocumentTagsRoutes.getAll.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    const documentTags = await this.documentTagsService.listDocumentTags(connectScope)
    return { data: documentTags.map(toAppDocumentTagDto) }
  }

  @CheckPermission(DOCUMENT_TAG_READ_PERMISSION, "project")
  @Get(AppsDocumentTagsRoutes.getOne.path)
  async getOne(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Req() request: AppRequest,
  ): Promise<typeof AppsDocumentTagsRoutes.getOne.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    const documentTag = await this.documentTagsService.findDocumentTagById({
      connectScope,
      documentTagId: id,
    })
    if (!documentTag) {
      throw new NotFoundException(`Document tag ${id} not found`)
    }
    return { data: toAppDocumentTagDto(documentTag) }
  }

  @CheckPermission(DOCUMENT_TAG_CREATE_PERMISSION, "project")
  @Post(AppsDocumentTagsRoutes.createOne.path)
  @HttpCode(HttpStatus.CREATED)
  @TrackActivity({ action: "documentTag.create" })
  async createOne(
    @Param("projectId") projectId: string,
    @Req() request: AppRequest,
    @Body() body: unknown,
  ): Promise<typeof AppsDocumentTagsRoutes.createOne.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    attachTrackedActivity(request, {
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
    })
    const parsed = createAppDocumentTagSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException("Invalid document tag payload")
    }

    const documentTag = await this.documentTagsService.createDocumentTag({
      connectScope,
      fields: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        parentId: parsed.data.parent_id ?? null,
      },
    })
    return { data: toAppDocumentTagDto(documentTag) }
  }

  @CheckPermission(DOCUMENT_TAG_UPDATE_PERMISSION, "project")
  @Patch(AppsDocumentTagsRoutes.updateOne.path)
  @TrackActivity({ action: "documentTag.update", entityFrom: "documentTag" })
  async updateOne(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Req() request: AppRequest,
    @Body() body: unknown,
  ): Promise<typeof AppsDocumentTagsRoutes.updateOne.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    const parsed = updateAppDocumentTagSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException("Invalid document tag payload")
    }

    const documentTag = await this.documentTagsService.updateDocumentTag({
      connectScope,
      documentTagId: id,
      fieldsToUpdate: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.parent_id !== undefined ? { parentId: parsed.data.parent_id } : {}),
      },
    })
    attachTrackedActivity(request, {
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      entityFrom: "documentTag",
      entityId: documentTag.id,
    })
    return { data: toAppDocumentTagDto(documentTag) }
  }

  @CheckPermission(DOCUMENT_TAG_DELETE_PERMISSION, "project")
  @Delete(AppsDocumentTagsRoutes.deleteOne.path)
  @HttpCode(HttpStatus.OK)
  @TrackActivity({ action: "documentTag.delete", entityFrom: "documentTag" })
  async deleteOne(
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Req() request: AppRequest,
  ): Promise<typeof AppsDocumentTagsRoutes.deleteOne.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    await this.documentTagsService.deleteDocumentTag({
      connectScope,
      documentTagId: id,
    })
    attachTrackedActivity(request, {
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      entityFrom: "documentTag",
      entityId: id,
    })
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

function toAppDocumentTagDto(documentTag: {
  id: string
  name: string
  description: string | null
  parentId: string | null
  createdAt: Date
  updatedAt: Date
}): AppDocumentTagDto {
  return {
    id: documentTag.id,
    name: documentTag.name,
    description: documentTag.description,
    parentId: documentTag.parentId,
    createdAt: documentTag.createdAt.getTime(),
    updatedAt: documentTag.updatedAt.getTime(),
  }
}
