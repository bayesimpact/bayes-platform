import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMemoriesService } from "@/domains/agents/memories/agent-memories.service"
import { CONVERSATION_RETENTION_SWEEP_QUEUE_NAME } from "./conversation-retention.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConversationRetentionSweepService } from "./conversation-retention-sweep.service"

@Processor(CONVERSATION_RETENTION_SWEEP_QUEUE_NAME)
export class ConversationRetentionSweepWorker extends WorkerHost {
  private readonly logger = new Logger(ConversationRetentionSweepWorker.name)

  constructor(
    private readonly retentionSweepService: ConversationRetentionSweepService,
    private readonly agentMemoriesService: AgentMemoriesService,
  ) {
    super()
  }

  async process(_job: Job): Promise<void> {
    // Agent memory deliberately outlives conversations, with its own expiry
    // (ADR 0023). The two sweeps never block each other.
    let expiredMemoryCount = 0
    try {
      expiredMemoryCount = await this.agentMemoriesService.deleteExpired()
    } catch (error) {
      this.logger.error("Agent memory expiry failed", (error as Error).stack)
    }
    const { purgedCount } = await this.retentionSweepService.sweepExpiredConversations()
    this.logger.log(
      `Conversation retention sweep finished (${purgedCount} session(s) purged, ${expiredMemoryCount} expired memory fact(s) deleted).`,
    )
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `Job failed: ${job?.name ?? "unknown"} (${job?.id ?? "unknown"})`,
      error.stack,
    )
  }
}
