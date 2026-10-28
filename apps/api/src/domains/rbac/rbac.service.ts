import { Injectable } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource, In, Not, type Repository } from "typeorm"
import {
  AGENT_CONVERSATION_REVIEWER_ROLE,
  AGENT_ROLE_PERMISSIONS,
  AGENT_ROLES,
  ORGANIZATION_ROLE_PERMISSIONS,
  ORGANIZATION_ROLES,
  PLATFORM_ORG_CREATOR_ROLE,
  PLATFORM_STAFF_ROLE,
  PLATFORM_SUPERADMIN_ROLE,
  PROJECT_ROLE_PERMISSIONS,
  PROJECT_ROLES,
  REVIEW_CAMPAIGN_ROLE_PERMISSIONS,
  REVIEW_CAMPAIGN_ROLES,
} from "./rbac.constants"
import { Role } from "./role.entity"
import { RolePermission } from "./role-permission.entity"

const ORGANIZATION_ROLE_LABELS: Record<string, string> = {
  org_owner: "Organization Owner",
  org_admin: "Organization Admin",
  org_member: "Organization Member",
  [PLATFORM_STAFF_ROLE]: "Platform Staff",
  [PLATFORM_SUPERADMIN_ROLE]: "Platform Superadmin",
  [PLATFORM_ORG_CREATOR_ROLE]: "Platform Organization Creator",
}

const PROJECT_ROLE_LABELS: Record<string, string> = {
  project_owner: "Project Owner",
  project_admin: "Project Admin",
  project_member: "Project Member",
}

const AGENT_ROLE_LABELS: Record<string, string> = {
  agent_owner: "Agent Owner",
  agent_admin: "Agent Admin",
  agent_member: "Agent Member",
  [AGENT_CONVERSATION_REVIEWER_ROLE]: "Agent Conversation Reviewer",
}

const REVIEW_CAMPAIGN_ROLE_LABELS: Record<string, string> = {
  [REVIEW_CAMPAIGN_ROLES.tester]: "Review Campaign Tester",
  [REVIEW_CAMPAIGN_ROLES.reviewer]: "Review Campaign Reviewer",
}

const GLOBAL_ROLE_SCOPE: Record<string, Role["scopeType"]> = {
  [PLATFORM_STAFF_ROLE]: "global",
  [PLATFORM_SUPERADMIN_ROLE]: "global",
  [PLATFORM_ORG_CREATOR_ROLE]: "global",
}

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    @InjectDataSource() readonly _dataSource: DataSource,
  ) {}

  /**
   * Idempotent catalog seed for the organization domain.
   * Production/deploy also seeds via migration `SeedOrganizationRbacRoles1783955500000`.
   * Kept for tests (`synchronize: true`) and local `seed:rbac`.
   */
  async seedOrganizationRolesAndPermissions(): Promise<void> {
    const rolesByKey = await this.upsertRoles({
      roleKeys: [
        ...Object.values(ORGANIZATION_ROLES),
        PLATFORM_STAFF_ROLE,
        PLATFORM_SUPERADMIN_ROLE,
        PLATFORM_ORG_CREATOR_ROLE,
      ],
      labels: ORGANIZATION_ROLE_LABELS,
      defaultScope: "organization",
    })
    await this.linkRolePermissions(rolesByKey, ORGANIZATION_ROLE_PERMISSIONS)
  }

  /**
   * Idempotent catalog seed for the project domain.
   * Production/deploy also seeds via migration `SeedProjectRbacRoles1784930000000`.
   * Kept for tests (`synchronize: true`) and local `seed:rbac`.
   */
  async seedProjectRolesAndPermissions(): Promise<void> {
    const rolesByKey = await this.upsertRoles({
      roleKeys: Object.values(PROJECT_ROLES),
      labels: PROJECT_ROLE_LABELS,
      defaultScope: "project",
    })
    await this.linkRolePermissions(rolesByKey, PROJECT_ROLE_PERMISSIONS)
  }

  /**
   * Idempotent catalog seed for the agent domain.
   * Production/deploy also seeds via migration `PlatformRolesAndPermissions1785320282681`.
   * Kept for tests (`synchronize: true`) and local `seed:rbac`.
   */
  async seedAgentRolesAndPermissions(): Promise<void> {
    const rolesByKey = await this.upsertRoles({
      roleKeys: [...Object.values(AGENT_ROLES), AGENT_CONVERSATION_REVIEWER_ROLE],
      labels: AGENT_ROLE_LABELS,
      defaultScope: "agent",
    })
    await this.linkRolePermissions(rolesByKey, AGENT_ROLE_PERMISSIONS)
  }

  /**
   * Idempotent catalog seed for the review campaign domain.
   * Production/deploy also seeds via migration `ReviewCampaignRoles1791800888000`.
   * Kept for tests (`synchronize: true`) and local `seed:rbac`.
   */
  async seedReviewCampaignRolesAndPermissions(): Promise<void> {
    const rolesByKey = await this.upsertRoles({
      roleKeys: Object.values(REVIEW_CAMPAIGN_ROLES),
      labels: REVIEW_CAMPAIGN_ROLE_LABELS,
      defaultScope: "review_campaign",
    })
    await this.linkRolePermissions(rolesByKey, REVIEW_CAMPAIGN_ROLE_PERMISSIONS)
  }

  private async upsertRoles({
    roleKeys,
    labels,
    defaultScope,
  }: {
    roleKeys: string[]
    labels: Record<string, string>
    defaultScope: Role["scopeType"]
  }): Promise<Map<string, Role>> {
    const rolesByKey = new Map<string, Role>()

    for (const roleKey of roleKeys) {
      const existing = await this.roleRepository.findOne({ where: { key: roleKey } })
      const scopeType = GLOBAL_ROLE_SCOPE[roleKey] ?? defaultScope
      const role =
        existing ??
        (await this.roleRepository.save(
          this.roleRepository.create({
            key: roleKey,
            name: labels[roleKey],
            scopeType,
          }),
        ))
      rolesByKey.set(roleKey, role)
    }

    return rolesByKey
  }

  private async linkRolePermissions(
    rolesByKey: Map<string, Role>,
    rolePermissions: Record<string, readonly string[]>,
  ): Promise<void> {
    for (const [roleKey, permissionKeys] of Object.entries(rolePermissions)) {
      const role = rolesByKey.get(roleKey)
      if (!role) continue

      // reconcile: drop grants removed from the catalog (e.g. project.read on org roles)
      await this.rolePermissionRepository.delete({
        roleId: role.id,
        permissionKey: Not(In([...permissionKeys])),
      })

      for (const permissionKey of permissionKeys) {
        const exists = await this.rolePermissionRepository.findOne({
          where: { roleId: role.id, permissionKey },
        })
        if (exists) continue

        await this.rolePermissionRepository.save(
          this.rolePermissionRepository.create({ roleId: role.id, permissionKey }),
        )
      }
    }
  }
}
