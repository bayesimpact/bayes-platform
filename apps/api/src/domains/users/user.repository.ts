import { Injectable } from "@nestjs/common"
import { IsNull, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { User } from "./user.entity"
import type { UserType } from "./user.types"

export type CreateUserParams = {
  authSubject: string | null
  email: string
  name: string | null
  pictureUrl: string | null
  type: UserType
}

/**
 * Repository for users.
 *
 * Write methods use TransactionService.getManager() so they participate in
 * whatever transaction is active in the current async context.
 */
@Injectable()
export class UserRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findByAuthSubject(authSubject: string): Promise<User | null> {
    return this.repo().findOne({ where: { authSubject } })
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo().findOne({ where: { email } })
  }

  async findById(id: string): Promise<User | null> {
    return this.repo().findOne({ where: { id } })
  }

  async createUser(params: CreateUserParams): Promise<User> {
    return this.repo().save(this.repo().create(params))
  }

  /** Returns null when the user does not exist. */
  async updateName(userId: string, name: string): Promise<User | null> {
    await this.repo().update(userId, { name })
    return this.findById(userId)
  }

  /** Attaches an OIDC identity to an existing account. Keeps the stored name and picture when the provider sends none. */
  async linkIdentity(params: {
    user: User
    authSubject: string
    name: string | null
    pictureUrl: string | null
  }): Promise<User> {
    params.user.authSubject = params.authSubject
    params.user.name = params.name ?? params.user.name
    params.user.pictureUrl = params.pictureUrl ?? params.user.pictureUrl
    return this.repo().save(params.user)
  }

  /**
   * Deletes a user by id.
   * Must be called from within a TransactionService.run() context when the
   * delete should roll back with the surrounding unit of work.
   */
  async deleteById({ userId }: { userId: string }): Promise<void> {
    await this.repo().delete({ id: userId })
  }

  /**
   * Deletes a person added by email who never signed in, once their last
   * membership is gone, so removed members leave no orphan account behind.
   */
  async deleteIfUnusedPlaceholder({ userId }: { userId: string }): Promise<void> {
    const user = await this.repo().findOne({
      where: { id: userId, authSubject: IsNull() },
      relations: { userMemberships: true },
    })
    if (!user || user.userMemberships.length > 0) return
    await this.repo().delete({ id: userId })
  }

  private repo(): Repository<User> {
    return this.transactionService.getManager().getRepository(User)
  }
}
