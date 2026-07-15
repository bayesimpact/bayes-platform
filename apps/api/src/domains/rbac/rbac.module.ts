import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { CheckPermissionGuard } from "./check-permission.guard"
import { Permission } from "./permission.entity"
import { PermissionService } from "./permission.service"
import { RbacService } from "./rbac.service"
import { Role } from "./role.entity"
import { RolePermission } from "./role-permission.entity"

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Role, Permission, RolePermission])],
  providers: [RbacService, PermissionService, CheckPermissionGuard],
  exports: [RbacService, PermissionService, CheckPermissionGuard],
})
export class RbacModule {}
