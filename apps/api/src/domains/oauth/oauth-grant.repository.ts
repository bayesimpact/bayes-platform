import { Injectable } from "@nestjs/common"
import { IsNull, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import type { OAuthClientRegistrationType } from "./oauth-client.entity"
import { OAuthGrant } from "./oauth-grant.entity"

export type OAuthGrantRecord = {
  id: string
  userId: string
  client: {
    id: string
    clientId: string
    clientName: string | null
    registrationType: OAuthClientRegistrationType
  }
  projects: { id: string; name: string }[]
  permissions: string[]
  resource: string
  revokedAt: Date | null
  createdAt: Date
  lastUsedAt: Date | null
}

const GRANT_RELATIONS = { oauthClient: true, projects: true } as const

@Injectable()
export class OAuthGrantRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async createGrant(params: {
    userId: string
    oauthClientId: string
    projectIds: string[]
    permissions: string[]
    resource: string
  }): Promise<OAuthGrantRecord> {
    const { projectIds, ...fields } = params
    const saved = await this.repo().save(
      this.repo().create({
        ...fields,
        projects: projectIds.map(
          (projectId) => ({ id: projectId }) as OAuthGrant["projects"][number],
        ),
      }),
    )
    return this.requireById(saved.id)
  }

  /** The grant, unless it was revoked. */
  async findActiveById(id: string): Promise<OAuthGrantRecord | null> {
    const row = await this.repo().findOne({
      where: { id, revokedAt: IsNull() },
      relations: GRANT_RELATIONS,
    })
    return row ? toRecord(row) : null
  }

  async listActiveByUserId(userId: string): Promise<OAuthGrantRecord[]> {
    const rows = await this.repo().find({
      where: { userId, revokedAt: IsNull() },
      relations: GRANT_RELATIONS,
      order: { createdAt: "DESC" },
    })
    return rows.map(toRecord)
  }

  /** Revokes the grant when it belongs to the user. Returns whether it did. */
  async revokeForUser(params: { id: string; userId: string; revokedAt: Date }): Promise<boolean> {
    const result = await this.repo().update(
      { id: params.id, userId: params.userId, revokedAt: IsNull() },
      { revokedAt: params.revokedAt },
    )
    return (result.affected ?? 0) > 0
  }

  async revoke(params: { id: string; revokedAt: Date }): Promise<void> {
    await this.repo().update(
      { id: params.id, revokedAt: IsNull() },
      { revokedAt: params.revokedAt },
    )
  }

  async markUsed(params: { id: string; usedAt: Date }): Promise<void> {
    await this.repo().update({ id: params.id }, { lastUsedAt: params.usedAt })
  }

  private async requireById(id: string): Promise<OAuthGrantRecord> {
    const row = await this.repo().findOneOrFail({ where: { id }, relations: GRANT_RELATIONS })
    return toRecord(row)
  }

  private repo(): Repository<OAuthGrant> {
    return this.transactionService.getManager().getRepository(OAuthGrant)
  }
}

function toRecord(row: OAuthGrant): OAuthGrantRecord {
  return {
    id: row.id,
    userId: row.userId,
    client: {
      id: row.oauthClient.id,
      clientId: row.oauthClient.clientId,
      clientName: row.oauthClient.clientName,
      registrationType: row.oauthClient.registrationType,
    },
    projects: (row.projects ?? []).map((project) => ({ id: project.id, name: project.name })),
    permissions: row.permissions,
    resource: row.resource,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  }
}
