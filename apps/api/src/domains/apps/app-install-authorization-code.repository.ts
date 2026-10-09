import { Injectable } from "@nestjs/common"
import { IsNull, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { AppInstallAuthorizationCode } from "./app-install-authorization-code.entity"

export type AppInstallAuthorizationCodeRecord = {
  id: string
  codeHash: string
  appInstallationId: string
  clientId: string
  clientSecret: string | null
  redirectUri: string
  expiresAt: Date
  consumedAt: Date | null
}

@Injectable()
export class AppInstallAuthorizationCodeRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async createAuthorizationCode(params: {
    codeHash: string
    appInstallationId: string
    clientId: string
    clientSecret: string
    redirectUri: string
    expiresAt: Date
  }): Promise<AppInstallAuthorizationCodeRecord> {
    const saved = await this.repo().save(this.repo().create(params))
    return this.toRecord(saved)
  }

  async findUnusedByCodeHash(codeHash: string): Promise<AppInstallAuthorizationCodeRecord | null> {
    const row = await this.repo().findOne({
      where: { codeHash, consumedAt: IsNull() },
    })
    return row ? this.toRecord(row) : null
  }

  async consumeAuthorizationCode(params: {
    id: string
    consumedAt: Date
  }): Promise<AppInstallAuthorizationCodeRecord | null> {
    const row = await this.repo().findOne({
      where: { id: params.id, consumedAt: IsNull() },
    })
    if (!row) return null
    row.consumedAt = params.consumedAt
    row.clientSecret = null
    return this.toRecord(await this.repo().save(row))
  }

  private repo(): Repository<AppInstallAuthorizationCode> {
    return this.transactionService.getManager().getRepository(AppInstallAuthorizationCode)
  }

  private toRecord(row: AppInstallAuthorizationCode): AppInstallAuthorizationCodeRecord {
    return {
      id: row.id,
      codeHash: row.codeHash,
      appInstallationId: row.appInstallationId,
      clientId: row.clientId,
      clientSecret: row.clientSecret,
      redirectUri: row.redirectUri,
      expiresAt: row.expiresAt,
      consumedAt: row.consumedAt,
    }
  }
}
