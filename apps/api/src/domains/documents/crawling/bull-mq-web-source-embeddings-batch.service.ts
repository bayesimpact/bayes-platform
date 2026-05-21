import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bullmq"
import type { CreateDocumentEmbeddingsJobPayload } from "../embeddings/document-embeddings.types"
import {
  WEB_SOURCE_EMBEDDINGS_JOB_NAME,
  WEB_SOURCE_EMBEDDINGS_QUEUE_NAME,
} from "./web-source-embeddings.constants"

@Injectable()
export class BullMqWebSourceEmbeddingsBatchService {
  private readonly logger = new Logger(BullMqWebSourceEmbeddingsBatchService.name)

  constructor(
    @InjectQueue(WEB_SOURCE_EMBEDDINGS_QUEUE_NAME)
    private readonly webSourceEmbeddingsQueue: Queue<CreateDocumentEmbeddingsJobPayload>,
  ) {}

  async enqueueCreateEmbeddingsForDocument(
    payload: CreateDocumentEmbeddingsJobPayload,
  ): Promise<void> {
    this.logger.log(`Enqueuing web source embeddings job ${JSON.stringify(payload)}`)
    await this.webSourceEmbeddingsQueue.add(WEB_SOURCE_EMBEDDINGS_JOB_NAME, payload)
  }
}
