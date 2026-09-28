import { Injectable, NotFoundException } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionDatasetDocumentRepository } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-dataset-document.repository"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWithEvaluationExtractionDatasetDocument } from "../request.interface"
import { getRequiredConnectScope } from "../request-context.helpers"

@Injectable()
export class EvaluationExtractionDatasetDocumentContextResolver implements ContextResolver {
  readonly resource = "evaluationExtractionDatasetDocument" as const

  constructor(
    private readonly evaluationExtractionDatasetDocumentRepository: EvaluationExtractionDatasetDocumentRepository,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { documentId?: string }
    }
    const documentId = requestWithParams.params?.documentId

    if (!documentId || documentId === ":documentId") throw new NotFoundException()

    const requestWithDocument = request as EndpointRequestWithEvaluationExtractionDatasetDocument
    const evaluationExtractionDatasetDocument =
      await this.evaluationExtractionDatasetDocumentRepository.findOne(
        getRequiredConnectScope(requestWithDocument),
        documentId,
      )
    if (!evaluationExtractionDatasetDocument) throw new NotFoundException()

    requestWithDocument.evaluationExtractionDatasetDocument = evaluationExtractionDatasetDocument
  }
}
