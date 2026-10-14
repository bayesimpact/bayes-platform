import { Injectable } from "@nestjs/common"
import { IsNull, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { OAuthRefreshToken } from "./oauth-refresh-token.entity"

export type OAuthRefreshTokenRecord = {
  id: string
  oauthGrantId: string
  expiresAt: Date
  usedAt: Date | null
}

@Injectable()
export class OAuthRefreshTokenRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async createToken(params: {
    tokenHash: string
    oauthGrantId: string
    expiresAt: Date
  }): Promise<void> {
    await this.repo().save(this.repo().create(params))
  }

  /** Used tokens included, so a replayed token can be told apart from an unknown one. */
  async findByHash(tokenHash: string): Promise<OAuthRefreshTokenRecord | null> {
    const row = await this.repo().findOneBy({ tokenHash })
    return row
      ? { id: row.id, oauthGrantId: row.oauthGrantId, expiresAt: row.expiresAt, usedAt: row.usedAt }
      : null
  }

  /** Marks the token used. False when it already was: someone else holds it too. */
  async markUsed(params: { id: string; usedAt: Date }): Promise<boolean> {
    const result = await this.repo().update(
      { id: params.id, usedAt: IsNull() },
      { usedAt: params.usedAt },
    )
    return (result.affected ?? 0) === 1
  }

  private repo(): Repository<OAuthRefreshToken> {
    return this.transactionService.getManager().getRepository(OAuthRefreshToken)
  }
}
