import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import {
  moduleFeatures,
  moduleImports,
  moduleProviders,
} from "@/domains/agents/base-agent-sessions/base-agent-sessions-module.helpers"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { AgentLlmModule } from "./agent-llm.module"
import { StreamingController } from "./streaming.controller"
import { StreamingService } from "./streaming.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([...moduleFeatures, ConversationAgentSession]),
    ...moduleImports,
    forwardRef(() => AgentLlmModule),
    forwardRef(() => ConversationAgentSessionsModule),
  ],
  providers: [...moduleProviders, StreamingService],
  controllers: [StreamingController],
  exports: [StreamingService],
})
export class StreamingModule {}
