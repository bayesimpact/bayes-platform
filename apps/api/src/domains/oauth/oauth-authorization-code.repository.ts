import { Injectable } from "@nestjs/common"
import { IsNull, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { OAuthAuthorizationCode } from "./oauth-authorization-code.entity"

export type OAuthAuthorizationCodeRecord = {
  id: string
  oauthGrantId: string
  redirectUri: string
  codeChallenge: string
  expiresAt: Date
}

@Injectable()
export class OAuthAuthorizationCodeRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async createCode(params: {
    codeHash: string
    oauthGrantId: string
    redirectUri: string
    codeChallenge: string
    expiresAt: Date
  }): Promise<void> {
    await this.repo().save(this.repo().create(params))
  }

  async findUnconsumedByHash(codeHash: string): Promise<OAuthAuthorizationCodeRecord | null> {
    const row = await this.repo().findOneBy({ codeHash, consumedAt: IsNull() })
    return row
      ? {
          id: row.id,
          oauthGrantId: row.oauthGrantId,
          redirectUri: row.redirectUri,
          codeChallenge: row.codeChallenge,
          expiresAt: row.expiresAt,
        }
      : null
  }

  /** Marks the code used. False when a concurrent request already did: the code is spent. */
  async consume(params: { id: string; consumedAt: Date }): Promise<boolean> {
    const result = await this.repo().update(
      { id: params.id, consumedAt: IsNull() },
      { consumedAt: params.consumedAt },
    )
    return (result.affected ?? 0) === 1
  }

  private repo(): Repository<OAuthAuthorizationCode> {
    return this.transactionService.getManager().getRepository(OAuthAuthorizationCode)
  }
}
