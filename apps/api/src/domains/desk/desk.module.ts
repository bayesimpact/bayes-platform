import { Module } from "@nestjs/common"
import { ResourceContextModule } from "@/common/context/resource-context.module"
import { AgentsModule } from "@/domains/agents/agents.module"
import { ConversationAgentSessionsModule } from "@/domains/agents/conversation-agent-sessions/conversation-agent-sessions.module"
import { AgentCsvExtractionRunsModule } from "@/domains/agents/csv-extraction-runs/agent-csv-extraction-runs.module"
import { ExtractionAgentSessionsModule } from "@/domains/agents/extraction-agent-sessions/extraction-agent-sessions.module"
import { AgentMemoriesStoreModule } from "@/domains/agents/memories/agent-memories-store.module"
import { AgentMessageFeedbackModule } from "@/domains/agents/shared/agent-session-messages/feedback/agent-message-feedback.module"
import { StreamingModule } from "@/domains/agents/shared/agent-session-messages/streaming/streaming.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { InvitationsModule } from "@/domains/invitations/invitations.module"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { TermsComplianceModule } from "@/domains/terms-compliance/terms-compliance.module"
import { UsersModule } from "@/domains/users/users.module"
import { DeskAccountController } from "./account/account.controller"
import { DeskAgentsController } from "./agents/agents.controller"
import { DeskConversationMessagesController } from "./conversations/conversation-messages.controller"
import { DeskConversationReplyController } from "./conversations/conversation-reply.controller"
import { DeskConversationsController } from "./conversations/conversations.controller"
import { DeskCsvExtractionsController } from "./csv-extractions/csv-extractions.controller"
import { DeskDocumentsController } from "./documents/documents.controller"
import { DeskExtractionsController } from "./extractions/extractions.controller"
import { DeskInvitationsController } from "./invitations/invitations.controller"
import { DeskMemoriesController } from "./memories/memories.controller"
import { DeskOrganizationsController } from "./organizations/organizations.controller"
import { DeskProjectsController } from "./projects/projects.controller"

/**
 * The Desk's own API: the routes of `@bayes-platform/desk-contracts`, each checked with the
 * schemas of its route. Each handler copies the logic of the endpoint the Desk called before.
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    RbacModule,
    ResourceContextModule,
    TermsComplianceModule,
    InvitationsModule,
    OrganizationsModule,
    ProjectsModule,
    AgentsModule,
    ConversationAgentSessionsModule,
    StreamingModule,
    AgentMessageFeedbackModule,
    StorageModule,
    AgentMemoriesStoreModule,
    ExtractionAgentSessionsModule,
    DocumentsModule,
    AgentCsvExtractionRunsModule,
  ],
  controllers: [
    DeskAccountController,
    DeskInvitationsController,
    DeskOrganizationsController,
    DeskProjectsController,
    DeskAgentsController,
    DeskConversationsController,
    DeskConversationMessagesController,
    DeskConversationReplyController,
    DeskDocumentsController,
    DeskMemoriesController,
    DeskExtractionsController,
    DeskCsvExtractionsController,
  ],
})
export class DeskModule {}
