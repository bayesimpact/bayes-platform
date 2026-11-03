import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { User } from "./user.entity"
import { UserRepository } from "./user.repository"
import { UsersService } from "./users.service"

@Module({
  imports: [TypeOrmModule.forFeature([User]), RbacModule],
  providers: [UsersService, UserRepository],
  exports: [UsersService, UserRepository],
})
export class UsersModule {}
