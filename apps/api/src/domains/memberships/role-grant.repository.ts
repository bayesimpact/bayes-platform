import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { resolveOrganizationRoleId } from "@/domains/rbac/resolve-organization-role-id"
import { RoleGrant } from "./role-grant.entity"

/**
 * Persistence layer for the unified `role_grant` table, for the writes that span several
 * resource types. Each domain reads and writes its own resource type through its own repository.
 *
 * Participates in the ambient transaction via TransactionService.getManager().
 */
@Injectable()
export class RoleGrantRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /** Org `org_member` plus a project row holding the installation's custom role. */
  async insertServiceUserInstallMemberships(params: {
    userId: string
    organizationId: string
    projectId: string
    customRoleId: string
  }): Promise<void> {
    await this.transactionService.run(async () => {
      const organizationRoleId = await resolveOrganizationRoleId(
        this.transactionService.getManager(),
        "member",
      )
      await this.repo().save([
        this.repo().create({
          userId: params.userId,
          resourceType: "organization",
          resourceId: params.organizationId,
          roleId: organizationRoleId,
        }),
        this.repo().create({
          userId: params.userId,
          resourceType: "project",
          resourceId: params.projectId,
          roleId: params.customRoleId,
        }),
      ])
    })
  }

  private repo(): Repository<RoleGrant> {
    return this.transactionService.getManager().getRepository(RoleGrant)
  }
}
