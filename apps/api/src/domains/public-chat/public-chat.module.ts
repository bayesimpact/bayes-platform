import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { Agent } from "@/domains/agents/agent.entity"
import { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { StreamingModule } from "@/domains/agents/shared/agent-session-messages/streaming/streaming.module"
import { AgentEmbedConfig } from "./agent-embed-configs/agent-embed-config.entity"
import { AgentEmbedConfigsService } from "./agent-embed-configs/agent-embed-configs.service"
import { EmbedTokenGuard } from "./guards/embed-token.guard"
import { PublicSessionTokenGuard } from "./guards/public-session-token.guard"
import { PublicAgentSession } from "./public-agent-sessions/public-agent-session.entity"
import { PublicAgentSessionsService } from "./public-agent-sessions/public-agent-sessions.service"
import { PublicChatController } from "./public-chat.controller"
import { PublicChatService } from "./public-chat.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentEmbedConfig, PublicAgentSession, AgentMessage, Agent]),
    StreamingModule,
  ],
  providers: [
    EmbedTokenGuard,
    PublicSessionTokenGuard,
    AgentEmbedConfigsService,
    PublicAgentSessionsService,
    PublicChatService,
  ],
  controllers: [PublicChatController],
  exports: [AgentEmbedConfigsService],
})
export class PublicChatModule {}
