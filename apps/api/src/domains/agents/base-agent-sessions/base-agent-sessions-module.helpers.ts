import { forwardRef } from "@nestjs/common"
import { AgentContextResolver } from "@/common/context/resolvers/agent-context.resolver"
import { AgentSessionContextResolver } from "@/common/context/resolvers/agent-session-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { AuthModule } from "@/domains/auth/auth.module"
import { Document } from "@/domains/documents/document.entity"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { Organization } from "@/domains/organizations/organization.entity"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { UsersModule } from "@/domains/users/users.module"
import { LlmModule } from "@/external/llm/llm.module"
import { Agent } from "../agent.entity"
import { ConversationAgentSession } from "../conversation-agent-sessions/conversation-agent-session.entity"
import { ConversationAgentSessionCategory } from "../conversation-agent-sessions/conversation-agent-session-category.entity"
import { ExtractionAgentSession } from "../extraction-agent-sessions/extraction-agent-session.entity"
import { FormAgentSession } from "../form-agent-sessions/form-agent-session.entity"
import { AgentSessionCategory } from "../session-categories/agent-session-category.entity"
import { AgentMessage } from "../shared/agent-session-messages/agent-message.entity"
import { AgentMessageAttachmentDocument } from "../shared/agent-session-messages/agent-message-attachment-document.entity"
import { BaseAgentSessionGuard } from "./base-agent-session.guard"
import { BaseAgentSessionsService } from "./base-agent-sessions.service"

export const moduleImports = [
  AuthModule,
  // Use dynamic require inside forwardRef to avoid circular static imports:
  // helpers.ts → DocumentsModule → ProjectsModule → AgentsModule → session modules → helpers.ts
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  forwardRef(() => require("../agents.module").AgentsModule),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  forwardRef(() => require("../../documents/documents.module").DocumentsModule),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  forwardRef(() => require("../../projects/projects.module").ProjectsModule),
  LlmModule,
  OrganizationsModule,
  StorageModule,
  UsersModule,
]
export const moduleFeatures = [
  Agent,
  AgentSessionCategory,
  AgentMessage,
  AgentMessageAttachmentDocument,
  ConversationAgentSession,
  ConversationAgentSessionCategory,
  Document,
  ExtractionAgentSession,
  FormAgentSession,
  Organization,
  Project,
  UserMembership,
]

export const moduleProviders = [
  AgentContextResolver,
  AgentSessionContextResolver,
  BaseAgentSessionGuard,
  BaseAgentSessionsService,
  OrganizationContextResolver,
  ProjectContextResolver,
  ResourceContextGuard,
]
