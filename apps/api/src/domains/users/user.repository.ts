import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { User } from "./user.entity"

/**
 * Repository for users.
 *
 * Write methods use TransactionService.getManager() so they participate in
 * whatever transaction is active in the current async context.
 */
@Injectable()
export class UserRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * Deletes a user by id.
   * Must be called from within a TransactionService.run() context when the
   * delete should roll back with the surrounding unit of work.
   */
  async deleteById({ userId }: { userId: string }): Promise<void> {
    await this.transactionService.getManager().getRepository(User).delete({ id: userId })
  }
}
