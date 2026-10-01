import {
  DOCUMENT_SOURCE_DELETE_PERMISSION,
  DOCUMENT_SOURCE_READ_PERMISSION,
  type DocumentSourceSummaryDto,
  DocumentSourcesRoutes,
} from "@caseai-connect/api-contracts"
import { Controller, Delete, Get, NotFoundException, Param, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "../documents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentSourcesService } from "./document-sources.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class DocumentSourcesController {
  constructor(
    private readonly documentSourcesService: DocumentSourcesService,
    private readonly documentsService: DocumentsService,
  ) {}

  @CheckPermission(DOCUMENT_SOURCE_READ_PERMISSION, "project")
  @Get(DocumentSourcesRoutes.getAll.path)
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof DocumentSourcesRoutes.getAll.response> {
    const documentSources = await this.documentSourcesService.listSummaries(
      getRequiredConnectScope(request),
    )
    return { data: documentSources.map(toDocumentSourceSummaryDto) }
  }

  @CheckPermission(DOCUMENT_SOURCE_DELETE_PERMISSION, "project")
  @Delete(DocumentSourcesRoutes.deleteOne.path)
  async deleteOne(
    @Req() request: EndpointRequestWithProject,
    @Param("documentSourceId") documentSourceId: string,
  ): Promise<typeof DocumentSourcesRoutes.deleteOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const documentSource = await this.documentSourcesService.getOne(connectScope, documentSourceId)
    if (!documentSource) {
      throw new NotFoundException(`Document source ${documentSourceId} not found`)
    }
    await this.documentsService.deleteDocumentsForSource(connectScope, documentSourceId)
    await this.documentSourcesService.softDeleteOne(connectScope, documentSourceId)
    return { data: { success: true } }
  }
}

function toDocumentSourceSummaryDto(documentSource: {
  id: string
  name: string
  type: string | null
  externalId: string | null
  baseUrl: string | null
  app: DocumentSourceSummaryDto["app"]
  documentCount: number
  indexedDocumentCount: number
  lastSyncedAt: Date | null
  status: DocumentSourceSummaryDto["status"]
  createdAt: Date
  updatedAt: Date
}): DocumentSourceSummaryDto {
  return {
    id: documentSource.id,
    name: documentSource.name,
    type: documentSource.type,
    externalId: documentSource.externalId,
    baseUrl: documentSource.baseUrl,
    app: documentSource.app,
    documentCount: documentSource.documentCount,
    indexedDocumentCount: documentSource.indexedDocumentCount,
    lastSyncedAt: documentSource.lastSyncedAt?.getTime() ?? null,
    status: documentSource.status,
    createdAt: documentSource.createdAt.getTime(),
    updatedAt: documentSource.updatedAt.getTime(),
  }
}
