import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import {
  moduleFeatures,
  moduleImports,
} from "@/domains/agents/base-agent-sessions/base-agent-sessions-module.helpers"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { McpServersModule } from "@/domains/mcp-servers/mcp-servers.module"
import { McpModule } from "@/external/mcp"
import { AgentMessageAttachmentDocumentsService } from "../agent-message-attachment-documents.service"
import { AgentLlmRequestService } from "./agent-llm-request.service"
import { ToolsService } from "./tools.service"

/**
 * Provides the shared agent LLM request building (tools + master prompt +
 * metadata) used by the Studio streaming path AND by out-of-request agent runs
 * (evaluation workers), so every caller assembles the agent identically.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([...moduleFeatures]),
    ...moduleImports,
    McpModule,
    McpServersModule,
    forwardRef(() => ConversationAgentSessionsModule),
  ],
  providers: [AgentLlmRequestService, AgentMessageAttachmentDocumentsService, ToolsService],
  exports: [AgentLlmRequestService, AgentMessageAttachmentDocumentsService, ToolsService],
})
export class AgentLlmModule {}
