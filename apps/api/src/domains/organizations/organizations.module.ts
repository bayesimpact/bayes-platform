import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { MembershipsModule } from "@/domains/memberships/memberships.module"
import { User } from "@/domains/users/user.entity"
import { UsersModule } from "@/domains/users/users.module"
import { OrganizationMembership } from "./memberships/organization-membership.entity"
import { OrganizationMembershipRepository } from "./memberships/organization-membership.repository"
import { OrganizationMembershipsService } from "./memberships/organization-memberships.service"
import { Organization } from "./organization.entity"
import { OrganizationGuard } from "./organization.guard"
import { OrganizationsController } from "./organizations.controller"
import { OrganizationsService } from "./organizations.service"
import { OrganizationsPolicyGuard } from "./organizations-policy.guard"
import { OrganizationAccountProvisioningService } from "./provisioning/organization-account-provisioning.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, OrganizationMembership, User]),
    ActivitiesModule,
    MembershipsModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    OrganizationsService,
    OrganizationMembershipRepository,
    OrganizationMembershipsService,
    OrganizationGuard,
    OrganizationsPolicyGuard,
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
