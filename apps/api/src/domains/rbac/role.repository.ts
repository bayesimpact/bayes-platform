import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
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

  private roleRepo(): Repository<Role> {
    return this.transactionService.getManager().getRepository(Role)
  }

  private grantRepo(): Repository<RolePermission> {
    return this.transactionService.getManager().getRepository(RolePermission)
  }
}
