import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { User } from "./user.entity"
import type { UserType } from "./user.types"

export type CreateUserParams = {
  auth0Id: string
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

  async findByAuth0Id(auth0Id: string): Promise<User | null> {
    return this.repo().findOne({ where: { auth0Id } })
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

  async updateAuth0Id(user: User, auth0Id: string): Promise<User> {
    user.auth0Id = auth0Id
    return this.repo().save(user)
  }

  async linkAuth0Identity(params: {
    user: User
    auth0Id: string
    name: string | null
    pictureUrl: string | null
  }): Promise<User> {
    params.user.auth0Id = params.auth0Id
    params.user.name = params.name
    params.user.pictureUrl = params.pictureUrl
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

  private repo(): Repository<User> {
    return this.transactionService.getManager().getRepository(User)
  }
}
