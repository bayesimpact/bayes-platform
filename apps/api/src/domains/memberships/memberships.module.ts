import { Module } from "@nestjs/common"
import { UserMembershipRepository } from "./user-membership.repository"

@Module({
  providers: [UserMembershipRepository],
  exports: [UserMembershipRepository],
})
export class MembershipsModule {}
