import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { UserMembership } from "./user-membership.entity"
import { UserMembershipService } from "./user-membership.service"

@Module({
  imports: [TypeOrmModule.forFeature([UserMembership])],
  providers: [UserMembershipService],
  exports: [UserMembershipService],
})
export class MembershipsModule {}
