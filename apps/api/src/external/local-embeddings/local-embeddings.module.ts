import { Module } from "@nestjs/common"
import { LocalEmbeddingBridgeService } from "./local-embedding-bridge.service"

/**
 * One bridge per worker process, shared by every module that embeds locally, so the Python
 * subprocess and its loaded models exist once.
 */
@Module({
  providers: [LocalEmbeddingBridgeService],
  exports: [LocalEmbeddingBridgeService],
})
export class LocalEmbeddingsModule {}
