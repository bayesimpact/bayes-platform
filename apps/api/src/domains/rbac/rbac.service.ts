import { Injectable } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource, type Repository } from "typeorm"
import { Permission } from "./permission.entity"
import {
  ORGANIZATION_PERMISSIONS,
  ORGANIZATION_ROLE_PERMISSIONS,
  ORGANIZATION_ROLES,
} from "./rbac.constants"
import { Role } from "./role.entity"
import { RolePermission } from "./role-permission.entity"

const ORGANIZATION_ROLE_LABELS: Record<string, string> = {
  org_owner: "Organization Owner",
  org_admin: "Organization Admin",
  org_member: "Organization Member",
}

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission) private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Idempotent catalog seed for the organization domain. */
  async seedOrganizationRolesAndPermissions(): Promise<void> {
    const permissionsByKey = await this.upsertPermissions(ORGANIZATION_PERMISSIONS)
    const rolesByKey = await this.upsertOrganizationRoles()
    await this.linkRolePermissions({ rolesByKey, permissionsByKey })
  }

  /** Maps legacy org membership roles to RBAC role_id. Org rows only. */
  async assignRoleIdsToOrganizationMemberships(): Promise<number> {
    let updatedCount = 0

    for (const [legacyRole, roleKey] of Object.entries(ORGANIZATION_ROLES)) {
      const updatedRows: { id: string }[] = await this.dataSource.query(
        `UPDATE user_membership AS membership
         SET role_id = role.id
         FROM role
         WHERE membership.resource_type = 'organization'
           AND membership.role_id IS NULL
           AND membership.role = $1
           AND role.key = $2
         RETURNING membership.id`,
        [legacyRole, roleKey],
      )
      updatedCount += updatedRows.length
    }

    return updatedCount
  }

  private async upsertPermissions(keys: readonly string[]): Promise<Map<string, Permission>> {
    const permissionsByKey = new Map<string, Permission>()

    for (const key of keys) {
      const existing = await this.permissionRepository.findOne({ where: { key } })
      const permission =
        existing ??
        (await this.permissionRepository.save(this.permissionRepository.create({ key })))
      permissionsByKey.set(key, permission)
    }

    return permissionsByKey
  }

  private async upsertOrganizationRoles(): Promise<Map<string, Role>> {
    const rolesByKey = new Map<string, Role>()

    for (const roleKey of Object.values(ORGANIZATION_ROLES)) {
      const existing = await this.roleRepository.findOne({ where: { key: roleKey } })
      const role =
        existing ??
        (await this.roleRepository.save(
          this.roleRepository.create({
            key: roleKey,
            name: ORGANIZATION_ROLE_LABELS[roleKey],
            scopeType: "organization",
          }),
        ))
      rolesByKey.set(roleKey, role)
    }

    return rolesByKey
  }

  private async linkRolePermissions({
    rolesByKey,
    permissionsByKey,
  }: {
    rolesByKey: Map<string, Role>
    permissionsByKey: Map<string, Permission>
  }): Promise<void> {
    for (const [roleKey, permissionKeys] of Object.entries(ORGANIZATION_ROLE_PERMISSIONS)) {
      const role = rolesByKey.get(roleKey)
      if (!role) continue

      for (const permissionKey of permissionKeys) {
        const permission = permissionsByKey.get(permissionKey)
        if (!permission) continue

        const exists = await this.rolePermissionRepository.findOne({
          where: { roleId: role.id, permissionId: permission.id },
        })
        if (exists) continue

        await this.rolePermissionRepository.save(
          this.rolePermissionRepository.create({ roleId: role.id, permissionId: permission.id }),
        )
      }
    }
  }
}
