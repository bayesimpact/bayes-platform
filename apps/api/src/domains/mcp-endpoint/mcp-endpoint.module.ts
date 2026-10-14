import { Module } from "@nestjs/common"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { AgentsModule } from "@/domains/agents/agents.module"
import { OAuthModule } from "@/domains/oauth/oauth.module"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { McpAgentToolsService } from "./mcp-agent-tools.service"
import { McpEndpointController } from "./mcp-endpoint.controller"
import { McpProtectedResourceController } from "./mcp-protected-resource.controller"

/** The platform's own MCP server, for MCP clients that create agents. */
@Module({
  imports: [ActivitiesModule, AgentsModule, OAuthModule, ProjectsModule, RbacModule, UsersModule],
  controllers: [McpEndpointController, McpProtectedResourceController],
  providers: [McpAgentToolsService],
})
export class McpEndpointModule {}
