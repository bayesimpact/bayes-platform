import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common"
import type { Queue } from "bullmq"
import { getConversationRetentionSweepCronPattern } from "./conversation-retention.config"
import {
  CONVERSATION_RETENTION_SWEEP_JOB_NAME,
  CONVERSATION_RETENTION_SWEEP_QUEUE_NAME,
  CONVERSATION_RETENTION_SWEEP_SCHEDULER_ID,
} from "./conversation-retention.constants"

@Injectable()
export class ConversationRetentionSweepSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ConversationRetentionSweepSchedulerService.name)

  constructor(
    @InjectQueue(CONVERSATION_RETENTION_SWEEP_QUEUE_NAME)
    private readonly retentionSweepQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const cronPattern = getConversationRetentionSweepCronPattern()

    await this.retentionSweepQueue.upsertJobScheduler(
      CONVERSATION_RETENTION_SWEEP_SCHEDULER_ID,
      { pattern: cronPattern },
      {
        name: CONVERSATION_RETENTION_SWEEP_JOB_NAME,
        data: {},
      },
    )

    this.logger.log(
      `Registered conversation retention sweep scheduler (cron "${cronPattern}", queue ${CONVERSATION_RETENTION_SWEEP_QUEUE_NAME}).`,
    )
  }
}
