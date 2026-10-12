import {
  type DocumentEmbeddingStatusChangedEventDto,
  type DocumentSourceType,
  DocumentsRoutes,
  type PresignFileResponseItemDto,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Request,
  Sse,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common"
import type { Observable } from "rxjs"
import { filter, map } from "rxjs"
import { v4 } from "uuid"
import type {
  EndpointRequestWithDocument,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import {
  DOCUMENT_CREATE_PERMISSION,
  DOCUMENT_DELETE_PERMISSION,
  DOCUMENT_READ_PERMISSION,
  DOCUMENT_UPDATE_PERMISSION,
  PROJECT_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { Document } from "./document.entity"
import { isPublicDocument, toDocumentDto } from "./documents.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "./documents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingStatusStreamService } from "./embeddings/document-embedding-status-stream.service"
import {
  DOCUMENT_EMBEDDINGS_BATCH_SERVICE,
  type DocumentEmbeddingsBatchService,
} from "./embeddings/document-embeddings-batch.interface"
import { FILE_STORAGE_SERVICE, type IFileStorage } from "./storage/file-storage.interface"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class DocumentsController {
  constructor(
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    @Inject(DOCUMENT_EMBEDDINGS_BATCH_SERVICE)
    private readonly documentEmbeddingsBatchService: DocumentEmbeddingsBatchService,
    private readonly documentsService: DocumentsService,
    private readonly documentEmbeddingStatusStreamService: DocumentEmbeddingStatusStreamService,
    private readonly permissionService: PermissionService,
  ) {}

  @Post(DocumentsRoutes.presignMany.path)
  @CheckPermission(DOCUMENT_CREATE_PERMISSION, "project")
  @HttpCode(HttpStatus.CREATED)
  async presignMany(
    @Body() { payload }: typeof DocumentsRoutes.presignMany.request,
    @Request() req: EndpointRequestWithProject,
    @Param("sourceType") sourceType: DocumentSourceType,
  ): Promise<typeof DocumentsRoutes.presignMany.response> {
    if (!sourceType) {
      throw new UnprocessableEntityException("Source type is required.")
    }
    if (!payload.files || payload.files.length === 0) {
      throw new UnprocessableEntityException("At least one file is required.")
    }

    const connectScope = getRequiredConnectScope(req)
    const results: PresignFileResponseItemDto[] = []

    for (const file of payload.files) {
      results.push(
        await this.documentsService.presignUpload({
          connectScope,
          file,
          sourceType,
          userId: req.user.id,
        }),
      )
    }

    return { data: results }
  }

  @Post(DocumentsRoutes.confirmMany.path)
  @CheckPermission(DOCUMENT_CREATE_PERMISSION, "project")
  @TrackActivity({ action: "document.createMany" })
  @HttpCode(HttpStatus.CREATED)
  async confirmMany(
    @Body() { payload }: typeof DocumentsRoutes.confirmMany.request,
    @Request() req: EndpointRequestWithProject,
  ): Promise<typeof DocumentsRoutes.confirmMany.response> {
    if (!payload.documentIds || payload.documentIds.length === 0) {
      throw new UnprocessableEntityException("At least one document ID is required.")
    }

    const connectScope = getRequiredConnectScope(req)
    const documents: Document[] = []

    const tagIds =
      payload.tagIds !== undefined && payload.tagIds.length > 0 ? payload.tagIds : undefined

    for (const documentId of payload.documentIds) {
      await this.documentsService.markAsUploaded({ connectScope, documentId })

      let document: Document
      if (tagIds !== undefined) {
        document = await this.documentsService.updateDocument({
          connectScope,
          documentId,
          fieldsToUpdate: { tagsToAdd: tagIds },
        })
      } else {
        const found = await this.documentsService.findById({ connectScope, documentId })
        if (!found) throw new NotFoundException(`Document ${documentId} not found`)
        document = found
      }

      if (document.sourceType === "project") {
        const embeddingPatch =
          await this.documentEmbeddingsBatchService.enqueueCreateEmbeddingsForDocument({
            documentId: document.id,
            organizationId: connectScope.organizationId,
            projectId: connectScope.projectId,
            uploadedByUserId: req.user.id,
            origin: "document-upload",
            currentTraceId: v4(),
          })
        document.embeddingStatus = embeddingPatch.embeddingStatus
        document.embeddingError = embeddingPatch.embeddingError
        document.updatedAt = embeddingPatch.updatedAt
      }
      documents.push(document)
    }

    return { data: documents.map(toDocumentDto) }
  }

  @Post(DocumentsRoutes.reprocessOne.path)
  @CheckPermission(DOCUMENT_UPDATE_PERMISSION, "project")
  @AddContext("document")
  async reprocessOne(
    @Request() req: EndpointRequestWithDocument,
  ): Promise<typeof DocumentsRoutes.reprocessOne.response> {
    const document = req.document
    if (document.sourceType !== "project") {
      throw new UnprocessableEntityException("Only project documents can be reprocessed.")
    }
    if (document.embeddingStatus !== "failed") {
      throw new UnprocessableEntityException("Only failed documents can be reprocessed.")
    }

    const connectScope = getRequiredConnectScope(req)
    await this.documentEmbeddingsBatchService.enqueueCreateEmbeddingsForDocument({
      documentId: document.id,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
      uploadedByUserId: req.user.id,
      origin: "document-upload",
      currentTraceId: v4(),
    })

    return { data: { success: true } }
  }

  @Get(DocumentsRoutes.getAll.path)
  @CheckPermission(DOCUMENT_READ_PERMISSION, "project")
  async getAll(
    @Request() req: EndpointRequestWithProject,
    @Param("sourceType") sourceType: DocumentSourceType,
  ): Promise<typeof DocumentsRoutes.getAll.response> {
    const documents = await this.documentsService.listDocuments(
      getRequiredConnectScope(req),
      sourceType,
    )
    return { data: documents.map(toDocumentDto) }
  }

  @Patch(DocumentsRoutes.updateOne.path)
  @CheckPermission(DOCUMENT_UPDATE_PERMISSION, "project")
  @AddContext("document")
  @TrackActivity({ action: "document.update", entityFrom: "document" })
  async updateOne(
    @Request() req: EndpointRequestWithDocument,
    @Body() { payload }: typeof DocumentsRoutes.updateOne.request,
  ): Promise<typeof DocumentsRoutes.updateOne.response> {
    await this.documentsService.updateDocument({
      connectScope: getRequiredConnectScope(req),
      documentId: req.document.id,
      fieldsToUpdate: payload,
    })

    return { data: { success: true } }
  }

  @Delete(DocumentsRoutes.deleteOne.path)
  @CheckPermission(DOCUMENT_DELETE_PERMISSION, "project")
  @AddContext("document")
  @TrackActivity({ action: "document.delete", entityFrom: "document" })
  async deleteOne(
    @Request() req: EndpointRequestWithDocument,
  ): Promise<typeof DocumentsRoutes.deleteOne.response> {
    const documentId = req.document.id

    await this.documentsService.deleteDocument({
      connectScope: getRequiredConnectScope(req),
      documentId,
    })

    return { data: { success: true } }
  }

  // Any project member can download a document tagged `public-documents`, the
  // single tag that exposes downloadable sources in chat. Any other document
  // takes `document.read`. DocumentContextResolver loads the document with its
  // tags so this can be checked.
  @Get(DocumentsRoutes.getTemporaryUrl.path)
  @CheckPermission(PROJECT_READ_PERMISSION, "project")
  @AddContext("document")
  @HttpCode(HttpStatus.CREATED)
  async getTemporaryUrl(
    @Request() req: EndpointRequestWithDocument,
  ): Promise<typeof DocumentsRoutes.getTemporaryUrl.response> {
    const document = req.document
    await this.assertCanDownload(req)

    const url = await this.fileStorageService.getTemporaryUrl(document.storageRelativePath)
    if (!url) {
      throw new NotFoundException("Temporary URL not found for the document.")
    }
    return { data: { url } }
  }

  // Reports whether a document is tagged `public-documents`. Drives the download
  // affordance for chat sources without trusting a value copied by the LLM. Any
  // project member can call it since it exposes only a boolean.
  @Get(DocumentsRoutes.getIsPublic.path)
  @CheckPermission(PROJECT_READ_PERMISSION, "project")
  @AddContext("document")
  async getIsPublic(
    @Request() req: EndpointRequestWithDocument,
  ): Promise<typeof DocumentsRoutes.getIsPublic.response> {
    return { data: { isPublicDocument: isPublicDocument(req.document) } }
  }

  @Sse(DocumentsRoutes.streamEmbeddingStatus.path, { method: 0 /* GET */ })
  @CheckPermission(DOCUMENT_READ_PERMISSION, "project")
  streamEmbeddingStatus(
    @Request() req: EndpointRequestWithProject,
  ): Observable<DocumentEmbeddingStatusChangedEventDto> {
    const connectScope = getRequiredConnectScope(req)
    return this.documentEmbeddingStatusStreamService.events$.pipe(
      filter(
        (event) =>
          event.organizationId === connectScope.organizationId &&
          event.projectId === connectScope.projectId,
      ),
      map((event) => ({ ...event, data: JSON.stringify(event) })),
    )
  }

  private async assertCanDownload(req: EndpointRequestWithDocument): Promise<void> {
    if (isPublicDocument(req.document)) {
      return
    }
    const isAllowed = await this.permissionService.has(req.user.id, DOCUMENT_READ_PERMISSION, {
      type: "project",
      id: req.project.id,
    })
    if (!isAllowed) {
      throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }
  }
}
