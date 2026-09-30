import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { LocalEmbeddingsModule } from "@/external/local-embeddings/local-embeddings.module"
import { ProjectEmbeddingModelsModule } from "./project-embedding-models.module"
import { PROJECT_EMBEDDING_REEMBED_QUEUE_NAME } from "./project-embedding-reembed.constants"
import { ProjectEmbeddingReembedService } from "./project-embedding-reembed.service"
import { ProjectEmbeddingReembedWorker } from "./project-embedding-reembed.worker"

/** Consumer side of the re-embedding queue. Runs on the GPU pool next to the local models. */
@Module({
  imports: [
    BullModule.registerQueue({
      name: PROJECT_EMBEDDING_REEMBED_QUEUE_NAME,
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    ProjectEmbeddingModelsModule,
    LocalEmbeddingsModule,
  ],
  providers: [ProjectEmbeddingReembedWorker, ProjectEmbeddingReembedService],
})
export class ProjectEmbeddingReembedWorkersModule {}
