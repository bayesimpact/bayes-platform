import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentRepository } from "@/domains/agents/agent.repository"
import { AuthModule } from "@/domains/auth/auth.module"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { DocumentTagsModule } from "@/domains/documents/tags/document-tags.module"
import { ProjectRepository } from "@/domains/projects/project.repository"
import { PublicChatModule } from "@/domains/public-chat/public-chat.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { AppGuard } from "./app.guard"
import { AppInstallAuthorizationCode } from "./app-install-authorization-code.entity"
import { AppInstallAuthorizationCodeRepository } from "./app-install-authorization-code.repository"
import { AppInstallation } from "./app-installation.entity"
import { AppInstallationRepository } from "./app-installation.repository"
import { AppJwtService } from "./app-jwt.service"
import { AppManifest } from "./app-manifest.entity"
import { AppManifestRepository } from "./app-manifest.repository"
import { AppsController } from "./apps.controller"
import { AppsService } from "./apps.service"
import { AppsInstallController } from "./apps-install.controller"
import { AppsV1Controller } from "./apps-v1.controller"
import { AppsConversationsController } from "./conversations/apps-conversations.controller"
import { AppsConversationsService } from "./conversations/apps-conversations.service"
import { AppsDocumentSourcesController } from "./document-sources/apps-document-sources.controller"
import { AppsDocumentTagsController } from "./document-tags/apps-document-tags.controller"
import { AppsDocumentsController } from "./documents/apps-documents.controller"

@Module({
  imports: [
    TypeOrmModule.forFeature([AppManifest, AppInstallation, AppInstallAuthorizationCode]),
    AuthModule,
    UsersModule,
    RbacModule,
    DocumentsModule,
    DocumentTagsModule,
    PublicChatModule,
  ],
  controllers: [
    AppsController,
    AppsInstallController,
    AppsV1Controller,
    AppsDocumentSourcesController,
    AppsDocumentTagsController,
    AppsDocumentsController,
    AppsConversationsController,
  ],
  providers: [
    AppsService,
    AppManifestRepository,
    AppInstallationRepository,
    AppInstallAuthorizationCodeRepository,
    AppJwtService,
    AppGuard,
    ProjectRepository,
    AgentRepository,
    AppsConversationsService,
  ],
  exports: [AppsService, AppManifestRepository, AppInstallationRepository, AppJwtService],
})
export class AppsModule {}
