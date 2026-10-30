import { Module } from "@nestjs/common"
import { RoleGrantRepository } from "./role-grant.repository"

@Module({
  providers: [RoleGrantRepository],
  exports: [RoleGrantRepository],
})
export class MembershipsModule {}
