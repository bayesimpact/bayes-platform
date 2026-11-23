import { Module } from "@nestjs/common"
import { ResourceContextModule } from "@/common/context/resource-context.module"
import { AgentsModule } from "@/domains/agents/agents.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { InvitationsModule } from "@/domains/invitations/invitations.module"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { TermsComplianceModule } from "@/domains/terms-compliance/terms-compliance.module"
import { UsersModule } from "@/domains/users/users.module"
import { DeskAccountController } from "./account/desk-account.controller"
import { DeskAgentsController } from "./agents/desk-agents.controller"
import { DeskInvitationsController } from "./invitations/desk-invitations.controller"
import { DeskOrganizationsController } from "./organizations/desk-organizations.controller"
import { DeskProjectsController } from "./projects/desk-projects.controller"

/**
 * The Desk's own API: the routes of `@caseai-connect/desk-contracts`, each checked with the
 * schemas of its route. Each handler copies the logic of the endpoint the Desk called before.
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    RbacModule,
    ResourceContextModule,
    TermsComplianceModule,
    InvitationsModule,
    OrganizationsModule,
    ProjectsModule,
    AgentsModule,
  ],
  controllers: [
    DeskAccountController,
    DeskInvitationsController,
    DeskOrganizationsController,
    DeskProjectsController,
    DeskAgentsController,
  ],
})
export class DeskModule {}
