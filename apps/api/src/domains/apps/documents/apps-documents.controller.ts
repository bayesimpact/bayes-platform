import {
  type AppDocumentCreatedDto,
  AppsDocumentsRoutes,
  DOCUMENT_CREATE_PERMISSION,
  parseCreateAppDocumentRequest,
} from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "@/domains/projects/project.repository"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { AppGuard } from "../app.guard"

type AppRequest = EndpointRequest & { appProjectId: string }

const DOCUMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

@Controller()
@UseGuards(AppGuard, CheckPermissionGuard)
export class AppsDocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly projectRepository: ProjectRepository,
  ) {}

  @CheckPermission(DOCUMENT_CREATE_PERMISSION, "project")
  @Post(AppsDocumentsRoutes.createOne.path)
  @HttpCode(HttpStatus.CREATED)
  async createOne(
    @Param("projectId") projectId: string,
    @Req() request: AppRequest,
    @Body() body: unknown,
  ): Promise<typeof AppsDocumentsRoutes.createOne.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    const parsed = parseCreateAppDocumentRequest(body)
    if (!parsed.success) {
      throw new BadRequestException("Invalid document payload")
    }

    if (parsed.data.kind === "content") {
      const document = await this.documentsService.createInlineProjectDocument({
        connectScope,
        userId: request.user.id,
        title: parsed.data.value.title,
        content: parsed.data.value.content,
        sourceUrl: parsed.data.value.source_url ?? null,
        documentSourceId: parsed.data.value.document_source_id,
      })
      return { data: toAppDocumentDto(document) }
    }

    const pendingUpload = await this.documentsService.createPendingProjectDocumentUpload({
      connectScope,
      userId: request.user.id,
      fileName: parsed.data.value.file_name,
      mimeType: parsed.data.value.mime_type,
      size: parsed.data.value.size,
      title: parsed.data.value.title,
      sourceUrl: parsed.data.value.source_url ?? null,
      documentSourceId: parsed.data.value.document_source_id,
    })
    return {
      data: {
        ...toAppDocumentDto(pendingUpload.document),
        uploadUrl: pendingUpload.uploadUrl,
        uploadHeaders: pendingUpload.uploadHeaders,
      },
    }
  }

  @CheckPermission(DOCUMENT_CREATE_PERMISSION, "project")
  @Post(AppsDocumentsRoutes.confirmOne.path)
  @HttpCode(HttpStatus.CREATED)
  async confirmOne(
    @Param("projectId") projectId: string,
    @Param("documentId") documentId: string,
    @Req() request: AppRequest,
  ): Promise<typeof AppsDocumentsRoutes.confirmOne.response> {
    if (!DOCUMENT_ID_PATTERN.test(documentId)) {
      throw new NotFoundException(`Document ${documentId} not found`)
    }
    const connectScope = await this.connectScopeFor(projectId, request)
    const document = await this.documentsService.confirmProjectDocumentUpload({
      connectScope,
      userId: request.user.id,
      documentId,
    })
    return { data: toAppDocumentDto(document) }
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

function toAppDocumentDto(document: AppDocumentCreatedDto): AppDocumentCreatedDto {
  return {
    id: document.id,
    title: document.title,
    projectId: document.projectId,
    sourceUrl: document.sourceUrl,
    embeddingStatus: document.embeddingStatus,
  }
}
