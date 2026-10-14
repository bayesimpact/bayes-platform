import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { OAuthClient, type OAuthClientRegistrationType } from "./oauth-client.entity"

export type OAuthClientRecord = {
  id: string
  clientId: string
  registrationType: OAuthClientRegistrationType
  clientName: string | null
  redirectUris: string[]
  metadataFetchedAt: Date | null
  createdAt: Date
}

@Injectable()
export class OAuthClientRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findByClientId(clientId: string): Promise<OAuthClientRecord | null> {
    const row = await this.repo().findOneBy({ clientId })
    return row ? toRecord(row) : null
  }

  async createClient(params: {
    clientId: string
    registrationType: OAuthClientRegistrationType
    clientName: string | null
    redirectUris: string[]
    metadataFetchedAt: Date | null
  }): Promise<OAuthClientRecord> {
    return toRecord(await this.repo().save(this.repo().create(params)))
  }

  /** Keeps the metadata document of a cimd client fresh. */
  async updateClientMetadata(
    id: string,
    fields: { clientName: string | null; redirectUris: string[]; metadataFetchedAt: Date },
  ): Promise<void> {
    await this.repo().update({ id }, fields)
  }

  /** Codes and refresh tokens past their expiry: nothing can use them any more. */
  async deleteExpiredCodesAndRefreshTokens(now: Date): Promise<void> {
    const manager = this.transactionService.getManager()
    await manager.query(`DELETE FROM "oauth_authorization_code" WHERE "expires_at" < $1`, [now])
    await manager.query(`DELETE FROM "oauth_refresh_token" WHERE "expires_at" < $1`, [now])
  }

  /** DCR clients registered before the date that no person ever approved. */
  async deleteUnusedDcrClientsCreatedBefore(date: Date): Promise<number> {
    const deletedRows: { id: string }[] = await this.transactionService.getManager().query(
      `DELETE FROM "oauth_client" client
       WHERE client."registration_type" = 'dcr'
         AND client."created_at" < $1
         AND NOT EXISTS (SELECT 1 FROM "oauth_grant" grant_row WHERE grant_row."oauth_client_id" = client."id")
       RETURNING client."id"`,
      [date],
    )
    return deletedRows.length
  }

  private repo(): Repository<OAuthClient> {
    return this.transactionService.getManager().getRepository(OAuthClient)
  }
}

function toRecord(row: OAuthClient): OAuthClientRecord {
  return {
    id: row.id,
    clientId: row.clientId,
    registrationType: row.registrationType,
    clientName: row.clientName,
    redirectUris: row.redirectUris,
    metadataFetchedAt: row.metadataFetchedAt,
    createdAt: row.createdAt,
  }
}
