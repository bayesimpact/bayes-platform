import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ActivitiesModule } from "@/domains/activities/activities.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { User } from "@/domains/users/user.entity"
import { UsersModule } from "@/domains/users/users.module"
import { OrganizationMembership } from "./memberships/organization-membership.entity"
import { OrganizationMembershipService } from "./memberships/organization-membership.service"
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
    UsersModule,
    AuthModule,
  ],
  providers: [
    OrganizationsService,
    OrganizationMembershipService,
    OrganizationGuard,
    OrganizationsPolicyGuard,
    OrganizationAccountProvisioningService,
  ],
  controllers: [OrganizationsController],
  exports: [
    OrganizationsService,
    OrganizationMembershipService,
    OrganizationAccountProvisioningService,
  ],
})
export class OrganizationsModule {}
