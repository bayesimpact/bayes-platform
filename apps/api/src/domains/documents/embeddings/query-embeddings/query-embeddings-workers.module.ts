import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { LocalEmbeddingsModule } from "@/external/local-embeddings/local-embeddings.module"
import { QUERY_EMBEDDINGS_QUEUE_NAME } from "./query-embeddings.constants"
import { QueryEmbeddingsWorker } from "./query-embeddings.worker"

/** Consumer side of the query embeddings queue. Runs on the GPU pool. */
@Module({
  imports: [
    BullModule.registerQueue({
      name: QUERY_EMBEDDINGS_QUEUE_NAME,
    }),
    LocalEmbeddingsModule,
  ],
  providers: [QueryEmbeddingsWorker],
})
export class QueryEmbeddingsWorkersModule {}
