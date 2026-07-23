import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConfigService } from "@nestjs/config"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource, type Repository } from "typeorm"
import {
  ORG_CREATOR_ROLE,
  ORGANIZATION_ROLE_PERMISSIONS,
  ORGANIZATION_ROLES,
  PROJECT_ROLE_PERMISSIONS,
  PROJECT_ROLES,
} from "./rbac.constants"
import { Role } from "./role.entity"
import { RolePermission } from "./role-permission.entity"

const ORGANIZATION_ROLE_LABELS: Record<string, string> = {
  org_owner: "Organization Owner",
  org_admin: "Organization Admin",
  org_member: "Organization Member",
  [ORG_CREATOR_ROLE]: "Organization Creator",
}

const PROJECT_ROLE_LABELS: Record<string, string> = {
  project_owner: "Project Owner",
  project_admin: "Project Admin",
  project_member: "Project Member",
}

const GLOBAL_ROLE_SCOPE: Record<string, Role["scopeType"]> = {
  [ORG_CREATOR_ROLE]: "global",
}

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Idempotent catalog seed for the organization domain.
   * Production/deploy also seeds via migration `SeedOrganizationRbacRoles1783955500000`.
   * Kept for tests (`synchronize: true`) and local `seed:rbac`.
   */
  async seedOrganizationRolesAndPermissions(): Promise<void> {
    const rolesByKey = await this.upsertRoles({
      roleKeys: [...Object.values(ORGANIZATION_ROLES), ORG_CREATOR_ROLE],
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

  /** Maps legacy org membership roles to RBAC role_id. Org rows only. */
  async assignRoleIdsToOrganizationMemberships(): Promise<number> {
    return this.assignRoleIdsToMemberships("organization", ORGANIZATION_ROLES)
  }

  /** Maps legacy project membership roles to RBAC role_id. Project rows only. */
  async assignRoleIdsToProjectMemberships(): Promise<number> {
    return this.assignRoleIdsToMemberships("project", PROJECT_ROLES)
  }

  private async assignRoleIdsToMemberships(
    resourceType: "organization" | "project",
    rolesByLegacyRole: Record<string, string>,
  ): Promise<number> {
    let updatedCount = 0

    for (const [legacyRole, roleKey] of Object.entries(rolesByLegacyRole)) {
      const updatedRows: { id: string }[] = await this.dataSource.query(
        `UPDATE user_membership AS membership
         SET role_id = role.id
         FROM role
         WHERE membership.resource_type = $1
           AND membership.role_id IS NULL
           AND membership.role = $2
           AND role.key = $3
         RETURNING membership.id`,
        [resourceType, legacyRole, roleKey],
      )
      updatedCount += updatedRows.length
    }

    return updatedCount
  }

  /** Grants org_creator to users whose email matches ORGANIZATION_CREATOR_EMAIL_DOMAIN. */
  async assignOrgCreatorToEligibleUsers(): Promise<number> {
    const allowedDomain = this.configService
      .get<string>("ORGANIZATION_CREATOR_EMAIL_DOMAIN")
      ?.trim()
    if (!allowedDomain) {
      return 0
    }

    const orgCreatorRole = await this.roleRepository.findOne({ where: { key: ORG_CREATOR_ROLE } })
    if (!orgCreatorRole) {
      return 0
    }

    const insertedRows: { id: string }[] = await this.dataSource.query(
      `INSERT INTO user_membership (user_id, resource_type, resource_id, role, role_id)
       SELECT user_account.id, 'global', NULL, 'member', $1
       FROM "user" AS user_account
       WHERE lower(trim(user_account.email)) LIKE '%' || lower(trim($2))
         AND user_account.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1
           FROM user_membership AS membership
           WHERE membership.user_id = user_account.id
             AND membership.resource_type = 'global'
             AND membership.role_id = $1
             AND membership.deleted_at IS NULL
         )
       RETURNING id`,
      [orgCreatorRole.id, allowedDomain],
    )

    return insertedRows.length
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
