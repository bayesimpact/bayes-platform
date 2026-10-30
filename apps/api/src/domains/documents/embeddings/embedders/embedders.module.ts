import { Module } from "@nestjs/common"
import { EmbedderService } from "./embedder.service"

/** Turns text into vectors with the Vertex models and the self-hosted HTTP embedders. */
@Module({
  providers: [EmbedderService],
  exports: [EmbedderService],
})
export class EmbeddersModule {}
