import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { AgentSessionCategory } from "@/domains/agents/session-categories/agent-session-category.entity"
import { AgentSettingsModule } from "@/domains/agents/settings/agent-settings.module"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { StreamingModule } from "@/domains/agents/shared/agent-session-messages/streaming/streaming.module"
import { AgentEmbedConfig } from "./agent-embed-configs/agent-embed-config.entity"
import { AgentEmbedConfigsService } from "./agent-embed-configs/agent-embed-configs.service"
import { EmbedTokenGuard } from "./guards/embed-token.guard"
import { PublicSessionTokenGuard } from "./guards/public-session-token.guard"
import { PublicAgentSession } from "./public-agent-sessions/public-agent-session.entity"
import { PublicAgentSessionCategory } from "./public-agent-sessions/public-agent-session-category.entity"
import { PublicAgentSessionsService } from "./public-agent-sessions/public-agent-sessions.service"
import { PublicChatService } from "./public-chat.service"
import { PublicChatV1Controller } from "./v1/public-chat-v1.controller"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEmbedConfig,
      PublicAgentSession,
      PublicAgentSessionCategory,
      AgentSessionCategory,
      AgentMessage,
      Agent,
    ]),
    AgentSettingsModule,
    StreamingModule,
    ConversationAgentSessionsModule,
  ],
  providers: [
    EmbedTokenGuard,
    PublicSessionTokenGuard,
    AgentEmbedConfigsService,
    PublicAgentSessionsService,
    PublicChatService,
  ],
  controllers: [PublicChatV1Controller],
  exports: [AgentEmbedConfigsService],
})
export class PublicChatModule {}
