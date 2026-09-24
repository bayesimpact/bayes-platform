import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { Role } from "./role.entity"
import { RolePermission } from "./role-permission.entity"

@Injectable()
export class RoleRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async createProjectRole(params: {
    key: string
    name: string
    permissionKeys: readonly string[]
  }): Promise<{ id: string; key: string }> {
    const saved = await this.roleRepo().save(
      this.roleRepo().create({
        key: params.key,
        name: params.name,
        scopeType: "project",
      }),
    )

    if (params.permissionKeys.length > 0) {
      await this.grantRepo().save(
        params.permissionKeys.map((permissionKey) =>
          this.grantRepo().create({ roleId: saved.id, permissionKey }),
        ),
      )
    }

    return { id: saved.id, key: saved.key }
  }

  async listPermissionKeysByRoleIds(roleIds: readonly string[]): Promise<Map<string, string[]>> {
    const uniqueRoleIds = [...new Set(roleIds)]
    if (uniqueRoleIds.length === 0) return new Map()

    const grants = await this.grantRepo().find({
      where: { roleId: In(uniqueRoleIds) },
      order: { permissionKey: "ASC" },
    })
    const permissionsByRoleId = new Map<string, string[]>()
    for (const grant of grants) {
      const permissionKeys = permissionsByRoleId.get(grant.roleId) ?? []
      permissionKeys.push(grant.permissionKey)
      permissionsByRoleId.set(grant.roleId, permissionKeys)
    }
    return permissionsByRoleId
  }

  private roleRepo(): Repository<Role> {
    return this.transactionService.getManager().getRepository(Role)
  }

  private grantRepo(): Repository<RolePermission> {
    return this.transactionService.getManager().getRepository(RolePermission)
  }
}
