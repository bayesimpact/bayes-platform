import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import {
  moduleFeatures,
  moduleImports,
  moduleProviders,
} from "@/domains/agents/base-agent-sessions/base-agent-sessions-module.helpers"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { FormAgentSession } from "@/domains/agents/form-agent-sessions/form-agent-session.entity"
import { FormAgentSessionsModule } from "@/domains/agents/form-agent-sessions/form-agent-sessions.module"
import { McpServersModule } from "@/domains/mcp-servers/mcp-servers.module"
import { McpModule } from "@/external/mcp"
import { AgentMessageAttachmentDocumentsService } from "../agent-message-attachment-documents.service"
import { StreamingController } from "./streaming.controller"
import { StreamingService } from "./streaming.service"
import { ToolsService } from "./tools.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([...moduleFeatures, ConversationAgentSession, FormAgentSession]),
    ...moduleImports,
    forwardRef(() => FormAgentSessionsModule),
    McpModule,
    McpServersModule,
    forwardRef(() => ConversationAgentSessionsModule),
  ],
  providers: [
    ...moduleProviders,
    AgentMessageAttachmentDocumentsService,
    StreamingService,
    ToolsService,
  ],
  controllers: [StreamingController],
  exports: [StreamingService],
})
export class StreamingModule {}
