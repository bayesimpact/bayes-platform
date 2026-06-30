import { forwardRef, Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { McpServerContextResolver } from "@/common/context/resolvers/mcp-server-context.resolver"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { AuthModule } from "@/domains/auth/auth.module"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { Project } from "@/domains/projects/project.entity"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { UsersModule } from "@/domains/users/users.module"
import { AgentMcpServer } from "./agent-mcp-server.entity"
import { EncryptionService } from "./encryption.service"
import { McpServer } from "./mcp-server.entity"
import { McpServerGuard } from "./mcp-server.guard"
import { McpServersController } from "./mcp-servers.controller"
import { McpServersService } from "./mcp-servers.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([
      McpServer,
      AgentMcpServer,
      Project,
      OrganizationMembership,
      ProjectMembership,
    ]),
    ConfigModule,
    OrganizationsModule,
    forwardRef(() => ProjectsModule),
    UsersModule,
    AuthModule,
  ],
  providers: [
    McpServersService,
    EncryptionService,
    McpServerGuard,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
    McpServerContextResolver,
  ],
  controllers: [McpServersController],
  exports: [McpServersService],
})
export class McpServersModule {}
