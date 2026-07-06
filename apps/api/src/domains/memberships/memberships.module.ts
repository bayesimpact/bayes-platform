import { Module } from "@nestjs/common"
import { UserMembershipService } from "./user-membership.service"

@Module({
  providers: [UserMembershipService],
  exports: [UserMembershipService],
})
export class MembershipsModule {}
