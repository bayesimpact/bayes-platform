import { EvalDocumentsRoutes } from "@bayes-platform/eval-contracts"
import {
  Controller,
  ForbiddenException,
  HttpStatus,
  Inject,
  NotFoundException,
  Req,
} from "@nestjs/common"
import type { EndpointRequestWithDocument } from "@/common/context/request.interface"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type { SchemaRouteResponse } from "@/common/schema-route/schema-route.types"
import { isPublicDocument } from "@/domains/documents/documents.helpers"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import { DOCUMENT_READ_PERMISSION, PROJECT_READ_PERMISSION } from "@/domains/rbac/rbac.constants"

const DOCUMENT_CONTEXT = ["organization", "project", "document"] as const

/**
 * The documents a reply cites as its sources. A copy of `DocumentsController.getIsPublic` and
 * `DocumentsController.getTemporaryUrl`.
 */
@Controller()
export class EvalDocumentsController {
  constructor(
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    private readonly permissionService: PermissionService,
  ) {}

  /** Reports whether a document is tagged `public-documents`. Any project member can ask. */
  @SchemaRoute(EvalDocumentsRoutes.getIsPublic, {
    permission: { key: PROJECT_READ_PERMISSION, on: "project" },
    context: [...DOCUMENT_CONTEXT],
  })
  async getIsPublic(
    @Req() request: EndpointRequestWithDocument,
  ): Promise<SchemaRouteResponse<typeof EvalDocumentsRoutes.getIsPublic>> {
    return { data: { isPublicDocument: isPublicDocument(request.document) } }
  }

  /**
   * Any project member can download a public document. Any other document takes `document.read`.
   */
  @SchemaRoute(EvalDocumentsRoutes.getTemporaryUrl, {
    permission: { key: PROJECT_READ_PERMISSION, on: "project" },
    context: [...DOCUMENT_CONTEXT],
    status: HttpStatus.CREATED,
  })
  async getTemporaryUrl(
    @Req() request: EndpointRequestWithDocument,
  ): Promise<SchemaRouteResponse<typeof EvalDocumentsRoutes.getTemporaryUrl>> {
    await this.assertCanDownload(request)
    const url = await this.fileStorageService.getTemporaryUrl(request.document.storageRelativePath)
    if (!url) {
      throw new NotFoundException("Temporary URL not found for the document.")
    }
    return { data: { url } }
  }

  private async assertCanDownload(request: EndpointRequestWithDocument): Promise<void> {
    if (isPublicDocument(request.document)) {
      return
    }
    const isAllowed = await this.permissionService.has(request.user.id, DOCUMENT_READ_PERMISSION, {
      type: "project",
      id: request.project.id,
    })
    if (!isAllowed) {
      throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_RESOURCE)
    }
  }
}
