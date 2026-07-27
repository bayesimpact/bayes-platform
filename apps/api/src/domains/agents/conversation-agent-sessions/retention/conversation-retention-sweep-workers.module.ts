import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ALL_ENTITIES } from "@/common/all-entities"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { LangfuseAdminService } from "@/external/langfuse/langfuse-admin"
import { ConversationAgentSessionPurgeService } from "./conversation-agent-session-purge.service"
import { CONVERSATION_RETENTION_SWEEP_QUEUE_NAME } from "./conversation-retention.constants"
import { ConversationRetentionSweepService } from "./conversation-retention-sweep.service"
import { ConversationRetentionSweepWorker } from "./conversation-retention-sweep.worker"
import { ConversationRetentionSweepSchedulerService } from "./conversation-retention-sweep-scheduler.service"

@Module({
  imports: [
    BullModule.registerQueue({
      name: CONVERSATION_RETENTION_SWEEP_QUEUE_NAME,
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    StorageModule,
  ],
  providers: [
    ConversationRetentionSweepWorker,
    ConversationRetentionSweepService,
    ConversationRetentionSweepSchedulerService,
    ConversationAgentSessionPurgeService,
    LangfuseAdminService,
  ],
})
export class ConversationRetentionSweepWorkersModule {}
