import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentContextResolver } from "@/common/context/resolvers/agent-context.resolver"
import { McpServerContextResolver } from "@/common/context/resolvers/mcp-server-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { Agent } from "@/domains/agents/agent.entity"
import { AuthModule } from "@/domains/auth/auth.module"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { Project } from "@/domains/projects/project.entity"
import { UsersModule } from "@/domains/users/users.module"
import { AgentMcpServer } from "./agent-mcp-server.entity"
import { BuiltInMcpServersService } from "./built-in/built-in-mcp-servers.service"
import { EncryptionService } from "./encryption.service"
import { McpServer } from "./mcp-server.entity"
import { McpServerGuard } from "./mcp-server.guard"
import { McpServersController } from "./mcp-servers.controller"
import { McpServersService } from "./mcp-servers.service"
import { McpOauthService } from "./oauth/mcp-oauth.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([McpServer, AgentMcpServer, Project, Agent]),
    ConfigModule,
    MembershipsModule,
    OrganizationsModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    McpServersService,
    McpOauthService,
    BuiltInMcpServersService,
    EncryptionService,
    McpServerGuard,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    AgentContextResolver,
    McpServerContextResolver,
  ],
  controllers: [McpServersController],
  exports: [McpServersService, McpOauthService, BuiltInMcpServersService],
})
export class McpServersModule {}
