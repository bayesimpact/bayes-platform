import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import {
  moduleFeatures,
  moduleImports,
  moduleProviders,
} from "../base-agent-sessions/base-agent-sessions-module.helpers"
import { AgentMessageAttachmentDocumentsService } from "../shared/agent-session-messages/agent-message-attachment-documents.service"
import { AgentMessagesController } from "../shared/agent-session-messages/agent-messages.controller"
import { StreamingModule } from "../shared/agent-session-messages/streaming/streaming.module"
import { ConversationAgentSessionsController } from "./conversation-agent-sessions.controller"
import { ConversationAgentSessionsService } from "./conversation-agent-sessions.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([...moduleFeatures]),
    ...moduleImports,
    forwardRef(() => StreamingModule),
  ],
  providers: [
    ...moduleProviders,
    AgentMessageAttachmentDocumentsService,
    ConversationAgentSessionsService,
    AgentSettingsService,
  ],
  controllers: [AgentMessagesController, ConversationAgentSessionsController],
  exports: [ConversationAgentSessionsService],
})
export class ConversationAgentSessionsModule {}
