import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { User } from "@/domains/users/user.entity"
import { UsersModule } from "@/domains/users/users.module"
import { OrganizationMembershipRepository } from "./memberships/organization-membership.repository"
import { OrganizationMembershipsService } from "./memberships/organization-memberships.service"
import { Organization } from "./organization.entity"
import { OrganizationGuard } from "./organization.guard"
import { OrganizationRepository } from "./organization.repository"
import { OrganizationsController } from "./organizations.controller"
import { OrganizationsService } from "./organizations.service"
import { OrganizationAccountProvisioningService } from "./provisioning/organization-account-provisioning.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, User]),
    ActivitiesModule,
    MembershipsModule,
    RbacModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    OrganizationsService,
    OrganizationMembershipRepository,
    OrganizationMembershipsService,
    OrganizationRepository,
    OrganizationGuard,
    OrganizationAccountProvisioningService,
  ],
  controllers: [OrganizationsController],
  exports: [
    OrganizationsService,
    OrganizationMembershipsService,
    OrganizationMembershipRepository,
    OrganizationAccountProvisioningService,
  ],
})
export class OrganizationsModule {}
