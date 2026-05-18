import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { Invitation } from "./invitation.entity"
import { InvitationPersistenceService } from "./invitation-persistence.service"

@Module({
  imports: [TypeOrmModule.forFeature([Invitation])],
  providers: [InvitationPersistenceService],
  exports: [TypeOrmModule, InvitationPersistenceService],
})
export class InvitationsPersistenceModule {}
