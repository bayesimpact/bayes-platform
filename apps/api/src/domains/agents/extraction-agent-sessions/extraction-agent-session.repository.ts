import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { ExtractionAgentSession } from "./extraction-agent-session.entity"

@Injectable()
export class ExtractionAgentSessionRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async deleteSession(
    connectScope: RequiredConnectScope,
    { agentId, sessionId }: { agentId: string; sessionId: string },
  ): Promise<void> {
    await this.connectRepo().deleteManyBy({
      connectScope,
      where: { agentId, id: sessionId },
      softDelete: false,
    })
  }

  private connectRepo(): ConnectRepository<ExtractionAgentSession> {
    return new ConnectRepository(this.repo(), "extractionAgentSession")
  }

  private repo(): Repository<ExtractionAgentSession> {
    return this.transactionService.getManager().getRepository(ExtractionAgentSession)
  }
}
