import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { getBullMqConnection } from "@/bullmq.config"
import { ALL_ENTITIES } from "@/common/all-entities"
import { DocumentsService } from "../documents.service"
import { DocumentEmbeddingStatusNotifierService } from "../embeddings/document-embedding-status-notifier.service"
import { DocumentEmbeddingsSharedService } from "../embeddings/document-embeddings-shared.service"
import { DocumentTagsService } from "../tags/document-tags.service"
import { WEB_SOURCE_EMBEDDINGS_QUEUE_NAME } from "./web-source-embeddings.constants"
import { WebPageEmbeddingsProcessorService } from "./web-page-embeddings-processor.service"
import { WebSourceEmbeddingsWorker } from "./web-source-embeddings.worker"

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        connection: getBullMqConnection(),
      }),
    }),
    BullModule.registerQueue({
      name: WEB_SOURCE_EMBEDDINGS_QUEUE_NAME,
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
  ],
  providers: [
    WebSourceEmbeddingsWorker,
    WebPageEmbeddingsProcessorService,
    DocumentEmbeddingsSharedService,
    DocumentEmbeddingStatusNotifierService,
    DocumentsService,
    DocumentTagsService,
  ],
})
export class WebSourceEmbeddingsWorkersModule {}
