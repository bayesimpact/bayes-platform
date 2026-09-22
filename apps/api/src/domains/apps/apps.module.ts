import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AuthModule } from "@/domains/auth/auth.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { AppInstallation } from "./app-installation.entity"
import { AppManifest } from "./app-manifest.entity"
import { AppManifestRepository } from "./app-manifest.repository"
import { AppsController } from "./apps.controller"
import { AppsService } from "./apps.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([AppManifest, AppInstallation]),
    AuthModule,
    UsersModule,
    RbacModule,
  ],
  controllers: [AppsController],
  providers: [AppsService, AppManifestRepository],
  exports: [AppsService, AppManifestRepository],
})
export class AppsModule {}
