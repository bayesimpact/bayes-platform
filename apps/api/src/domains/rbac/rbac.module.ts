import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { Permission } from "./permission.entity"
import { RbacService } from "./rbac.service"
import { Role } from "./role.entity"
import { RolePermission } from "./role-permission.entity"

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, RolePermission])],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
