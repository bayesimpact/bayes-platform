import { Injectable, NotFoundException } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWithDocument } from "../request.interface"
import { getRequiredConnectScope } from "../request-context.helpers"

@Injectable()
export class DocumentContextResolver implements ContextResolver {
  readonly resource = "document" as const

  constructor(private readonly documentsService: DocumentsService) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { documentId?: string }
    }
    const documentId = requestWithParams.params?.documentId

    if (!documentId || documentId === ":documentId") throw new NotFoundException()

    const requestWithDocument = request as EndpointRequestWithDocument
    const document =
      (await this.documentsService.findById({
        connectScope: getRequiredConnectScope(requestWithDocument),
        documentId,
        // Load tags so policies (e.g. canDownload) can inspect whether the
        // document is publicly accessible.
        withTags: true,
      })) ?? undefined
    if (!document) throw new NotFoundException()

    requestWithDocument.document = document
  }
}
