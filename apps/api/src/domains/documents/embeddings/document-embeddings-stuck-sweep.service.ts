import { Injectable, Logger } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Brackets, type Repository } from "typeorm"
import { Document } from "../document.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "../documents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentEmbeddingStatusNotifierService } from "./document-embedding-status-notifier.service"
import { DOCUMENT_EMBEDDINGS_ENQUEUE_FAILED_ERROR_MESSAGE } from "./document-embeddings.constants"
import { getDocumentEmbeddingStuckThresholdSeconds } from "./document-embeddings-stuck.config"
import {
  DOCUMENT_EMBEDDINGS_STUCK_SWEEP_BATCH_LIMIT,
  DOCUMENT_EMBEDDINGS_STUCK_TIMEOUT_ERROR_MESSAGE,
} from "./document-embeddings-stuck.constants"

@Injectable()
export class DocumentEmbeddingsStuckSweepService {
  private readonly logger = new Logger(DocumentEmbeddingsStuckSweepService.name)

  constructor(
    @InjectRepository(Document) private readonly documentRepository: Repository<Document>,
    private readonly documentsService: DocumentsService,
    private readonly embeddingStatusNotifierService: DocumentEmbeddingStatusNotifierService,
  ) {}

  async sweepStuckDocuments(): Promise<{ timedOutCount: number }> {
    const thresholdSeconds = getDocumentEmbeddingStuckThresholdSeconds()
    const cutoff = new Date(Date.now() - thresholdSeconds * 1000)

    // `pending` + uploaded project documents are those whose enqueue never happened
    // (for example the API crashed between the upload confirm and the queue add).
    const stuckDocuments = await this.documentRepository
      .createQueryBuilder("document")
      .where(
        new Brackets((statusWhere) => {
          statusWhere
            .where("document.embedding_status IN (:...statuses)", {
              statuses: ["queued", "processing"],
            })
            .orWhere(
              "document.embedding_status = :pendingStatus AND document.upload_status = :uploadedStatus AND document.source_type = :projectSourceType",
              {
                pendingStatus: "pending",
                uploadedStatus: "uploaded",
                projectSourceType: "project",
              },
            )
        }),
      )
      .andWhere("document.updated_at < :cutoff", { cutoff })
      .orderBy("document.updated_at", "ASC")
      .limit(DOCUMENT_EMBEDDINGS_STUCK_SWEEP_BATCH_LIMIT)
      .getMany()

    for (const document of stuckDocuments) {
      const wasNeverEnqueued = document.embeddingStatus === "pending"
      document.embeddingStatus = "failed"
      document.embeddingError = wasNeverEnqueued
        ? DOCUMENT_EMBEDDINGS_ENQUEUE_FAILED_ERROR_MESSAGE
        : DOCUMENT_EMBEDDINGS_STUCK_TIMEOUT_ERROR_MESSAGE
      const savedDocument = await this.documentsService.saveOne(document)
      await this.embeddingStatusNotifierService.notifyEmbeddingStatusChanged({
        documentId: savedDocument.id,
        organizationId: savedDocument.organizationId,
        projectId: savedDocument.projectId,
        embeddingStatus: savedDocument.embeddingStatus,
        embeddingError: savedDocument.embeddingError ?? null,
        updatedAt: savedDocument.updatedAt.getTime(),
      })
    }

    if (stuckDocuments.length > 0) {
      this.logger.log(
        `Marked ${stuckDocuments.length} document(s) as failed (embedding stuck past threshold).`,
      )
    }

    return { timedOutCount: stuckDocuments.length }
  }
}
