import { Module } from "@nestjs/common"
import { EvaluationContextModule } from "@/common/context/evaluation-context.module"
import { ResourceContextModule } from "@/common/context/resource-context.module"
import { AgentsModule } from "@/domains/agents/agents.module"
import { AuthModule } from "@/domains/auth/auth.module"
import { StorageModule } from "@/domains/documents/storage/storage.module"
import { InvitationsModule } from "@/domains/invitations/invitations.module"
import { OrganizationsModule } from "@/domains/organizations/organizations.module"
import { ProjectsModule } from "@/domains/projects/projects.module"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { EvalAccountController } from "./account/account.controller"
import { EvalAgentsController } from "./agents/agents.controller"
import { EvalDocumentsController } from "./documents/documents.controller"
import { EvalInvitationsController } from "./invitations/invitations.controller"
import { EvalOrganizationsController } from "./organizations/organizations.controller"
import { EvalProjectsController } from "./projects/projects.controller"

/**
 * The evaluation app's own API: the routes of `@caseai-connect/eval-contracts`, each checked with
 * the schemas of its route. Each handler copies the logic of the endpoint the app called before.
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    RbacModule,
    ResourceContextModule,
    EvaluationContextModule,
    InvitationsModule,
    OrganizationsModule,
    ProjectsModule,
    AgentsModule,
    StorageModule,
  ],
  controllers: [
    EvalAccountController,
    EvalInvitationsController,
    EvalOrganizationsController,
    EvalProjectsController,
    EvalAgentsController,
    EvalDocumentsController,
  ],
})
export class EvalModule {}
