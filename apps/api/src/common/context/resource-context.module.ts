import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { Agent } from "@/domains/agents/agent.entity"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { AgentCsvExtractionRun } from "@/domains/agents/csv-extraction-runs/agent-csv-extraction-run.entity"
import { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { Project } from "@/domains/projects/project.entity"
import { AgentContextResolver } from "./resolvers/agent-context.resolver"
import { AgentCsvExtractionRunContextResolver } from "./resolvers/agent-csv-extraction-run-context.resolver"
import { AgentSessionContextResolver } from "./resolvers/agent-session-context.resolver"
import { DocumentContextResolver } from "./resolvers/document-context.resolver"
import { OrganizationContextResolver } from "./resolvers/organization-context.resolver"
import { ProjectContextResolver } from "./resolvers/project-context.resolver"
import { ResourceContextGuard } from "./resource-context.guard"

const resolvers = [
  OrganizationContextResolver,
  ProjectContextResolver,
  AgentContextResolver,
  AgentSessionContextResolver,
  AgentCsvExtractionRunContextResolver,
  DocumentContextResolver,
]

/**
 * Gives a module the `organization`, `project`, `agent`, `agentSession`, `agentCsvExtractionRun`
 * and `document` contexts with the repositories and the service they read, and the guard that runs
 * them. A module of another domain uses it so it does not import the entities of these domains.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      Agent,
      ConversationAgentSession,
      ExtractionAgentSession,
      AgentCsvExtractionRun,
    ]),
    // The document resolver reads the document through DocumentsService.
    DocumentsModule,
  ],
  providers: [...resolvers, ResourceContextGuard],
  exports: [...resolvers, ResourceContextGuard],
})
export class ResourceContextModule {}
