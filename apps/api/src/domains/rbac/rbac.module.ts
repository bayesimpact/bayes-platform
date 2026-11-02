import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { CheckPermissionGuard } from "./check-permission.guard"
import { PermissionService } from "./permission.service"
import { PlatformRoleRepository } from "./platform-role.repository"
import { PlatformRoleService } from "./platform-role.service"
import { RbacService } from "./rbac.service"
import { Role } from "./role.entity"
import { RoleRepository } from "./role.repository"
import { RoleGrantRepository } from "./role-grant.repository"
import { RolePermission } from "./role-permission.entity"

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Role, RolePermission])],
  providers: [
    RbacService,
    PermissionService,
    CheckPermissionGuard,
    PlatformRoleRepository,
    PlatformRoleService,
    RoleRepository,
    RoleGrantRepository,
  ],
  exports: [
    RbacService,
    PermissionService,
    CheckPermissionGuard,
    PlatformRoleService,
    RoleRepository,
    RoleGrantRepository,
  ],
})
export class RbacModule {}
