import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AuthModule } from "@/domains/auth/auth.module"
import { ProjectRepository } from "@/domains/projects/project.repository"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { AppInstallation } from "./app-installation.entity"
import { AppInstallationRepository } from "./app-installation.repository"
import { AppManifest } from "./app-manifest.entity"
import { AppManifestRepository } from "./app-manifest.repository"
import { AppsController } from "./apps.controller"
import { AppsService } from "./apps.service"
import { AppsInstallController } from "./apps-install.controller"

@Module({
  imports: [
    TypeOrmModule.forFeature([AppManifest, AppInstallation]),
    AuthModule,
    UsersModule,
    RbacModule,
  ],
  controllers: [AppsController, AppsInstallController],
  providers: [AppsService, AppManifestRepository, AppInstallationRepository, ProjectRepository],
  exports: [AppsService, AppManifestRepository, AppInstallationRepository],
})
export class AppsModule {}
