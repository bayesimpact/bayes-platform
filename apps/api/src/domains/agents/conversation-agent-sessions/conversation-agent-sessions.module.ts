import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentSettingsModule } from "@/domains/agents/settings/agent-settings.module"
import { PdfPagesModule } from "@/domains/documents/pdf-pages/pdf-pages.module"
import { McpServersModule } from "@/domains/mcp-servers/mcp-servers.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { McpModule } from "@/external/mcp"
import {
  moduleFeatures,
  moduleImports,
  moduleProviders,
} from "../base-agent-sessions/base-agent-sessions-module.helpers"
import { AgentConversationReviewersModule } from "../conversation-reviewers/agent-conversation-reviewers.module"
import { AgentMessageAttachmentDocumentsService } from "../shared/agent-session-messages/agent-message-attachment-documents.service"
import { LiveAgentMessagesController } from "../shared/agent-session-messages/live-agent-messages.controller"
import { McpAppHtmlService } from "../shared/agent-session-messages/mcp-app-html.service"
import { PlaygroundAgentMessagesController } from "../shared/agent-session-messages/playground-agent-messages.controller"
import { StreamingModule } from "../shared/agent-session-messages/streaming/streaming.module"
import { ConversationAgentSessionsService } from "./conversation-agent-sessions.service"
import { LiveConversationAgentSessionsController } from "./live-conversation-agent-sessions.controller"
import { PlaygroundConversationAgentSessionsController } from "./playground-conversation-agent-sessions.controller"
import { ConversationRetentionSweepRun } from "./retention/conversation-retention-sweep-run.entity"
import { ConversationRetentionSweepRunsController } from "./retention/conversation-retention-sweep-runs.controller"
import { ConversationReviewController } from "./review/conversation-review.controller"
import { ConversationReviewRepository } from "./review/conversation-review.repository"
import { ConversationReviewService } from "./review/conversation-review.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([...moduleFeatures, ConversationRetentionSweepRun]),
    ...moduleImports,
    forwardRef(() => AgentSettingsModule),
    forwardRef(() => StreamingModule),
    McpModule,
    McpServersModule,
    PdfPagesModule,
    RbacModule,
    AgentConversationReviewersModule,
  ],
  providers: [
    ...moduleProviders,
    AgentMessageAttachmentDocumentsService,
    ConversationAgentSessionsService,
    ConversationReviewRepository,
    ConversationReviewService,
    McpAppHtmlService,
  ],
  controllers: [
    ConversationRetentionSweepRunsController,
    ConversationReviewController,
    LiveAgentMessagesController,
    LiveConversationAgentSessionsController,
    PlaygroundAgentMessagesController,
    PlaygroundConversationAgentSessionsController,
  ],
  exports: [ConversationAgentSessionsService, McpAppHtmlService],
})
export class ConversationAgentSessionsModule {}
