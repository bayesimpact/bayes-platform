import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { OrganizationContextResolver } from "@/common/context/resolvers/organization-context.resolver"
import { ProjectContextResolver } from "@/common/context/resolvers/project-context.resolver"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { AgentRepository } from "@/domains/agents/agent.repository"
import { AuthModule } from "@/domains/auth/auth.module"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { DocumentTagsModule } from "@/domains/documents/tags/document-tags.module"
import { Project } from "@/domains/projects/project.entity"
import { ProjectRepository } from "@/domains/projects/project.repository"
import { PublicChatModule } from "@/domains/public-chat/public-chat.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { AppGuard } from "./app.guard"
import { AppAccessTokenService } from "./app-access-token.service"
import { AppInstallation } from "./app-installation.entity"
import { AppInstallationRepository } from "./app-installation.repository"
import { AppManifest } from "./app-manifest.entity"
import { AppManifestRepository } from "./app-manifest.repository"
import { AppsController } from "./apps.controller"
import { AppsService } from "./apps.service"
import { AppsV1Controller } from "./apps-v1.controller"
import { AppsConversationsController } from "./conversations/apps-conversations.controller"
import { AppsConversationsService } from "./conversations/apps-conversations.service"
import { AppsDocumentSourcesController } from "./document-sources/apps-document-sources.controller"
import { AppsDocumentTagsController } from "./document-tags/apps-document-tags.controller"
import { AppsDocumentsController } from "./documents/apps-documents.controller"
import { ProjectAppInstallationsController } from "./project-app-installations.controller"

@Module({
  imports: [
    TypeOrmModule.forFeature([AppManifest, AppInstallation, Project]),
    AuthModule,
    UsersModule,
    RbacModule,
    DocumentsModule,
    DocumentTagsModule,
    PublicChatModule,
  ],
  controllers: [
    AppsController,
    AppsV1Controller,
    AppsDocumentSourcesController,
    AppsDocumentTagsController,
    AppsDocumentsController,
    AppsConversationsController,
    ProjectAppInstallationsController,
  ],
  providers: [
    AppsService,
    AppManifestRepository,
    AppInstallationRepository,
    AppAccessTokenService,
    AppGuard,
    ProjectRepository,
    AgentRepository,
    AppsConversationsService,
    ResourceContextGuard,
    OrganizationContextResolver,
    ProjectContextResolver,
  ],
  exports: [AppsService, AppManifestRepository, AppInstallationRepository],
})
export class AppsModule {}
