import { Module } from "@nestjs/common"
import { ContextModule } from "@/common/context/context.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { DeskAccountController } from "./account/desk-account.controller"
import { DeskAccountService } from "./account/desk-account.service"

/**
 * The Desk's endpoints, under `desk/` (ADR 0031, section 2.13). A cross-domain module of the
 * read-model layer: it maps the records of the feature modules' exported services onto the Desk
 * contracts, and registers no entity of another domain.
 */
@Module({
  imports: [
    ContextModule,
    AuthModule,
    UsersModule,
    RbacModule,
    ProjectsModule,
    OrganizationsModule,
  ],
  controllers: [DeskAccountController],
  providers: [DeskAccountService],
})
export class DeskModule {}
