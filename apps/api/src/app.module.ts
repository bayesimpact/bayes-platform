import { BullModule } from "@nestjs/bullmq"
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { getBullMqConnection } from "./bullmq.config"
import { BullBoardAdminModule } from "./common/bull-board/bull-board-admin.module"
import { DiagnosticsModule } from "./common/diagnostics/diagnostics.module"
import { RequestLoggerMiddleware } from "./common/middleware/request-logger.middleware"
import typeorm from "./config/typeorm"
import { AgentsModule } from "./domains/agents/agents.module"
import { ConversationAgentSessionsModule } from "./domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { AgentCsvExtractionRunsModule } from "./domains/agents/csv-extraction-runs/agent-csv-extraction-runs.module"
import { ExtractionAgentSessionsModule } from "./domains/agents/extraction-agent-sessions/extraction-agent-sessions.module"
import { FormAgentSessionsModule } from "./domains/agents/form-agent-sessions/form-agent-sessions.module"
import { AgentMessageFeedbackModule } from "./domains/agents/shared/agent-session-messages/feedback/agent-message-feedback.module"
import { StreamingModule } from "./domains/agents/shared/agent-session-messages/streaming/streaming.module"
import { AgentsAnalyticsModule } from "./domains/analytics/agents-analytics/agents-analytics.module"
import { ProjectsAnalyticsModule } from "./domains/analytics/projects-analytics/projects-analytics.module"
import { AuthModule } from "./domains/auth/auth.module"
import { BackofficeModule } from "./domains/backoffice/backoffice.module"
import { DocumentsModule } from "./domains/documents/documents.module"
import { StorageModule } from "./domains/documents/storage/storage.module"
import { DocumentTagsModule } from "./domains/documents/tags/document-tags.module"
import { EvaluationsModule } from "./domains/evaluations/evaluations.module"
import { InvitationsModule } from "./domains/invitations/invitations.module"
import { MeModule } from "./domains/me/me.module"
import { OrganizationsModule } from "./domains/organizations/organizations.module"
import { ProjectsModule } from "./domains/projects/projects.module"
import { AgentEmbedConfigsManagementModule } from "./domains/public-chat/agent-embed-configs/agent-embed-configs-management.module"
import { PublicChatModule } from "./domains/public-chat/public-chat.module"
import { ReviewCampaignsModule } from "./domains/review-campaigns/review-campaigns.module"
import { TermsComplianceModule } from "./domains/terms-compliance/terms-compliance.module"
import { UsersModule } from "./domains/users/users.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [typeorm],
    }),
    BullModule.forRootAsync({
      useFactory: () => ({ connection: getBullMqConnection() }),
    }),
    BullBoardAdminModule.registerWhenEnabled(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => configService.get("typeorm")(),
    }),
    AgentEmbedConfigsManagementModule,
    AgentMessageFeedbackModule,
    AgentsAnalyticsModule,
    AgentCsvExtractionRunsModule,
    AgentsModule,
    AuthModule,
    BackofficeModule,
    ConversationAgentSessionsModule,
    DiagnosticsModule,
    DocumentsModule,
    DocumentTagsModule,
    EvaluationsModule,
    ExtractionAgentSessionsModule,
    FormAgentSessionsModule,
    InvitationsModule,
    MeModule,
    OrganizationsModule,
    OrganizationsModule,
    ProjectsAnalyticsModule,
    ProjectsModule,
    ProjectsModule,
    PublicChatModule,
    ReviewCampaignsModule,
    StorageModule,
    StreamingModule,
    TermsComplianceModule,
    UsersModule,
    UsersModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*")
  }
}
