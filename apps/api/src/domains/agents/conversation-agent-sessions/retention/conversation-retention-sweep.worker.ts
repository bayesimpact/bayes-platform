import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import { CONVERSATION_RETENTION_SWEEP_QUEUE_NAME } from "./conversation-retention.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationRetentionSweepService } from "./conversation-retention-sweep.service"

@Processor(CONVERSATION_RETENTION_SWEEP_QUEUE_NAME)
export class ConversationRetentionSweepWorker extends WorkerHost {
  private readonly logger = new Logger(ConversationRetentionSweepWorker.name)

  constructor(private readonly retentionSweepService: ConversationRetentionSweepService) {
    super()
  }

  async process(_job: Job): Promise<void> {
    const { purgedCount } = await this.retentionSweepService.sweepExpiredConversations()
    this.logger.log(`Conversation retention sweep finished (${purgedCount} session(s) purged).`)
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `Job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"})`,
      error.stack,
    )
  }
}
