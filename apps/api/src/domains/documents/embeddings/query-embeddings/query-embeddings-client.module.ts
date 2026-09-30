import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { BullMqQueryEmbeddingsClientService } from "./bull-mq-query-embeddings-client.service"
import { QUERY_EMBEDDINGS_QUEUE_NAME } from "./query-embeddings.constants"

/** Producer side of the query embeddings queue (API). */
@Module({
  imports: [
    BullModule.registerQueue({
      name: QUERY_EMBEDDINGS_QUEUE_NAME,
    }),
  ],
  providers: [BullMqQueryEmbeddingsClientService],
  exports: [BullMqQueryEmbeddingsClientService],
})
export class QueryEmbeddingsClientModule {}
