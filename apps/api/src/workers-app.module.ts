import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { getBullMqConnection } from "./bullmq.config"
import { WorkersHealthModule } from "./common/workers-health/workers-health.module"
import typeorm from "./config/typeorm"
import { UrlCrawlingWorkersModule } from "./domains/documents/crawling/url-crawling-workers.module"
import { WebSourceEmbeddingsWorkersModule } from "./domains/documents/crawling/web-source-embeddings-workers.module"
import { DocumentEmbeddingsWorkersModule } from "./domains/documents/embeddings/document-embeddings-workers.module"
import { StorageModule } from "./domains/documents/storage/storage.module"
import { EvaluationExtractionRunWorkersModule } from "./domains/evaluations/extraction/runs/evaluation-extraction-run-workers.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [typeorm],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => configService.get("typeorm")(),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        connection: getBullMqConnection(),
      }),
    }),
    DocumentEmbeddingsWorkersModule,
    EvaluationExtractionRunWorkersModule,
    UrlCrawlingWorkersModule,
    WebSourceEmbeddingsWorkersModule,
    StorageModule,
    WorkersHealthModule,
  ],
})
export class WorkersAppModule {}
