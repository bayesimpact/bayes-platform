import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Optional,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { Reflector } from "@nestjs/core"
import type { ContextResolver } from "./context-resolver.interface"
import {
  ADD_CONTEXT_KEY,
  type ContextResource,
  REQUIRE_CONTEXT_KEY,
} from "./require-context.decorator"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentContextResolver } from "./resolvers/agent-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentCsvExtractionRunContextResolver } from "./resolvers/agent-csv-extraction-run-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipContextResolver } from "./resolvers/agent-membership-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSessionContextResolver } from "./resolvers/agent-session-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSessionInCampaignContextResolver } from "./resolvers/agent-session-in-campaign-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentContextResolver } from "./resolvers/document-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentTagContextResolver } from "./resolvers/document-tag-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationContextResolver } from "./resolvers/evaluation-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionDatasetContextResolver } from "./resolvers/evaluation-extraction-dataset-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunContextResolver } from "./resolvers/evaluation-extraction-run-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationScopeContextResolver } from "./resolvers/invitation-scope-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpServerContextResolver } from "./resolvers/mcp-server-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationContextResolver } from "./resolvers/organization-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectContextResolver } from "./resolvers/project-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipContextResolver } from "./resolvers/project-membership-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ResourceLibraryContextResolver } from "./resolvers/resource-library-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignContextResolver } from "./resolvers/review-campaign-context.resolver"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignMembershipContextResolver } from "./resolvers/review-campaign-membership-context.resolver"

const RESOLUTION_ORDER: ContextResource[] = [
  "organization",
  "project",
  "projectMembership",
  "agent",
  "agentMembership",
  "agentSession",
  "agentCsvExtractionRun",
  "document",
  "documentTag",
  "resourceLibrary",
  "mcpServer",
  "evaluation",
  "evaluationExtractionDataset",
  "evaluationExtractionRun",
  "agentSessionInCampaign",
  "reviewCampaign",
  "reviewCampaignMembership",
  "invitationScope",
]

@Injectable()
export class ResourceContextGuard implements CanActivate {
  private readonly resolverMap: Map<ContextResource, ContextResolver>

  constructor(
    private reflector: Reflector,
    @Optional() organizationContextResolver?: OrganizationContextResolver,
    @Optional() projectContextResolver?: ProjectContextResolver,
    @Optional() projectMembershipContextResolver?: ProjectMembershipContextResolver,
    @Optional() agentContextResolver?: AgentContextResolver,
    @Optional() agentMembershipContextResolver?: AgentMembershipContextResolver,
    @Optional() agentSessionContextResolver?: AgentSessionContextResolver,
    @Optional() agentCsvExtractionRunContextResolver?: AgentCsvExtractionRunContextResolver,
    @Optional() documentContextResolver?: DocumentContextResolver,
    @Optional() documentTagContextResolver?: DocumentTagContextResolver,
    @Optional() resourceLibraryContextResolver?: ResourceLibraryContextResolver,
    @Optional() mcpServerContextResolver?: McpServerContextResolver,
    @Optional() evaluationContextResolver?: EvaluationContextResolver,
    @Optional()
    evaluationExtractionDatasetContextResolver?: EvaluationExtractionDatasetContextResolver,
    @Optional() evaluationExtractionRunContextResolver?: EvaluationExtractionRunContextResolver,
    @Optional() reviewCampaignContextResolver?: ReviewCampaignContextResolver,
    @Optional()
    reviewCampaignMembershipContextResolver?: ReviewCampaignMembershipContextResolver,
    @Optional()
    agentSessionInCampaignContextResolver?: AgentSessionInCampaignContextResolver,
    @Optional()
    invitationScopeContextResolver?: InvitationScopeContextResolver,
  ) {
    const resolverEntries: Array<[ContextResource, ContextResolver]> = []
    if (organizationContextResolver) {
      resolverEntries.push([organizationContextResolver.resource, organizationContextResolver])
    }
    if (projectContextResolver) {
      resolverEntries.push([projectContextResolver.resource, projectContextResolver])
    }
    if (projectMembershipContextResolver) {
      resolverEntries.push([
        projectMembershipContextResolver.resource,
        projectMembershipContextResolver,
      ])
    }
    if (agentContextResolver) {
      resolverEntries.push([agentContextResolver.resource, agentContextResolver])
    }
    if (agentMembershipContextResolver) {
      resolverEntries.push([
        agentMembershipContextResolver.resource,
        agentMembershipContextResolver,
      ])
    }
    if (agentSessionContextResolver) {
      resolverEntries.push([agentSessionContextResolver.resource, agentSessionContextResolver])
    }
    if (agentCsvExtractionRunContextResolver) {
      resolverEntries.push([
        agentCsvExtractionRunContextResolver.resource,
        agentCsvExtractionRunContextResolver,
      ])
    }
    if (documentContextResolver) {
      resolverEntries.push([documentContextResolver.resource, documentContextResolver])
    }
    if (documentTagContextResolver) {
      resolverEntries.push([documentTagContextResolver.resource, documentTagContextResolver])
    }
    if (resourceLibraryContextResolver) {
      resolverEntries.push([
        resourceLibraryContextResolver.resource,
        resourceLibraryContextResolver,
      ])
    }
    if (mcpServerContextResolver) {
      resolverEntries.push([mcpServerContextResolver.resource, mcpServerContextResolver])
    }
    if (evaluationContextResolver) {
      resolverEntries.push([evaluationContextResolver.resource, evaluationContextResolver])
    }
    if (evaluationExtractionDatasetContextResolver) {
      resolverEntries.push([
        evaluationExtractionDatasetContextResolver.resource,
        evaluationExtractionDatasetContextResolver,
      ])
    }
    if (evaluationExtractionRunContextResolver) {
      resolverEntries.push([
        evaluationExtractionRunContextResolver.resource,
        evaluationExtractionRunContextResolver,
      ])
    }
    if (reviewCampaignContextResolver) {
      resolverEntries.push([reviewCampaignContextResolver.resource, reviewCampaignContextResolver])
    }
    if (reviewCampaignMembershipContextResolver) {
      resolverEntries.push([
        reviewCampaignMembershipContextResolver.resource,
        reviewCampaignMembershipContextResolver,
      ])
    }
    if (agentSessionInCampaignContextResolver) {
      resolverEntries.push([
        agentSessionInCampaignContextResolver.resource,
        agentSessionInCampaignContextResolver,
      ])
    }
    if (invitationScopeContextResolver) {
      resolverEntries.push([
        invitationScopeContextResolver.resource,
        invitationScopeContextResolver,
      ])
    }
    this.resolverMap = new Map(resolverEntries)
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    const classLevelResources =
      this.reflector.get<ContextResource[]>(REQUIRE_CONTEXT_KEY, context.getClass()) ?? []
    const methodLevelRequiredResources = this.reflector.get<ContextResource[]>(
      REQUIRE_CONTEXT_KEY,
      context.getHandler(),
    )
    const methodLevelAddedResources =
      this.reflector.get<ContextResource[]>(ADD_CONTEXT_KEY, context.getHandler()) ?? []

    const baseResources = methodLevelRequiredResources ?? classLevelResources
    const requestedResources = [...new Set([...baseResources, ...methodLevelAddedResources])]

    for (const resourceToResolve of RESOLUTION_ORDER) {
      if (!requestedResources.includes(resourceToResolve)) continue

      const resolver = this.resolverMap.get(resourceToResolve)
      if (!resolver) {
        throw new InternalServerErrorException(
          `No resolver configured for context resource: ${resourceToResolve}`,
        )
      }
      await resolver.resolve(request)
    }

    return true
  }
}
