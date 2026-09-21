import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { User } from "./user.entity"
import { UserRepository } from "./user.repository"
import { UsersService } from "./users.service"

@Module({
  imports: [TypeOrmModule.forFeature([User]), MembershipsModule],
  providers: [UsersService, UserRepository],
  exports: [UsersService, UserRepository],
})
export class UsersModule {}
