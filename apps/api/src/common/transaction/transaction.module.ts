import { Global, Module } from "@nestjs/common"
import { TransactionService } from "./transaction.service"

/**
 * Global module — imported once in AppModule.
 * TransactionService is available everywhere without per-module imports.
 */
@Global()
@Module({
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
