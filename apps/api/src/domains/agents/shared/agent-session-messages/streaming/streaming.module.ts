import { forwardRef, Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import {
  moduleFeatures,
  moduleImports,
  moduleProviders,
} from "@/domains/agents/base-agent-sessions/base-agent-sessions-module.helpers"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { ActiveAgentScopeService } from "./active-agent-scope.service"
import { AgentLlmModule } from "./agent-llm.module"
import { LiveStreamingController } from "./live-streaming.controller"
import { PlaygroundStreamingController } from "./playground-streaming.controller"
import { ReviewCampaignTesterStreamingController } from "./review-campaign-tester-streaming.controller"
import { StreamingLlmService } from "./streaming-llm.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([...moduleFeatures, ConversationAgentSession]),
    ...moduleImports,
    forwardRef(() => AgentLlmModule),
    forwardRef(() => ConversationAgentSessionsModule),
    RbacModule,
  ],
  providers: [...moduleProviders, StreamingLlmService, ActiveAgentScopeService],
  controllers: [
    LiveStreamingController,
    PlaygroundStreamingController,
    ReviewCampaignTesterStreamingController,
  ],
  exports: [StreamingLlmService, ActiveAgentScopeService],
})
export class StreamingModule {}
