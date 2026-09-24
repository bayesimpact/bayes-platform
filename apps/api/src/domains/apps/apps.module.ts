import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AuthModule } from "@/domains/auth/auth.module"
import { DocumentsModule } from "@/domains/documents/documents.module"
import { ProjectRepository } from "@/domains/projects/project.repository"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { AppGuard } from "./app.guard"
import { AppInstallation } from "./app-installation.entity"
import { AppInstallationRepository } from "./app-installation.repository"
import { AppJwtService } from "./app-jwt.service"
import { AppManifest } from "./app-manifest.entity"
import { AppManifestRepository } from "./app-manifest.repository"
import { AppsController } from "./apps.controller"
import { AppsService } from "./apps.service"
import { AppsInstallController } from "./apps-install.controller"
import { AppsV1Controller } from "./apps-v1.controller"

@Module({
  imports: [
    TypeOrmModule.forFeature([AppManifest, AppInstallation]),
    AuthModule,
    UsersModule,
    RbacModule,
    DocumentsModule,
  ],
  controllers: [AppsController, AppsInstallController, AppsV1Controller],
  providers: [
    AppsService,
    AppManifestRepository,
    AppInstallationRepository,
    AppJwtService,
    AppGuard,
    ProjectRepository,
  ],
  exports: [AppsService, AppManifestRepository, AppInstallationRepository, AppJwtService],
})
export class AppsModule {}
