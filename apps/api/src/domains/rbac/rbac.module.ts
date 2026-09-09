import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { CheckPermissionGuard } from "./check-permission.guard"
import { PermissionService } from "./permission.service"
import { PlatformRoleService } from "./platform-role.service"
import { RbacService } from "./rbac.service"
import { Role } from "./role.entity"
import { RolePermission } from "./role-permission.entity"

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Role, RolePermission])],
  providers: [RbacService, PermissionService, CheckPermissionGuard, PlatformRoleService],
  exports: [RbacService, PermissionService, CheckPermissionGuard, PlatformRoleService],
})
export class RbacModule {}
