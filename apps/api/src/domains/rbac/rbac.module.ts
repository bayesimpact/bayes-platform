import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { CaslAbilityGuard } from "@/common/policies/casl-ability.guard"
import { AbilityFactory } from "./ability.factory"
import { Permission } from "./permission.entity"
import { RbacService } from "./rbac.service"
import { Role } from "./role.entity"
import { RolePermission } from "./role-permission.entity"
import { UserRole } from "./user-role.entity"

@Module({
  imports: [TypeOrmModule.forFeature([Permission, Role, RolePermission, UserRole])],
  providers: [RbacService, AbilityFactory, CaslAbilityGuard],
  exports: [RbacService, AbilityFactory, CaslAbilityGuard],
})
export class RbacModule {}
