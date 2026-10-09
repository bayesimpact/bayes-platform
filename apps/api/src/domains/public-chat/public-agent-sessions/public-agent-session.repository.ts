import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { PublicAgentSession } from "./public-agent-session.entity"

/** A conversation opened by an App, as the apps domain sees it. */
export type AppConversationRecord = {
  id: string
  agentId: string
  appInstallationId: string
  externalVisitorId: string | null
  createdAt: Date
}

/**
 * Sessions opened by an installed App. They carry no session token: the App
 * authenticates every call, and its installation id scopes every lookup.
 */
@Injectable()
export class PublicAgentSessionRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async createAppSession({
    connectScope,
    agentId,
    appInstallationId,
    externalVisitorId,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    appInstallationId: string
    externalVisitorId: string
  }): Promise<AppConversationRecord> {
    const session = await this.repo().save(
      this.repo().create({
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
        agentId,
        appInstallationId,
        embedConfigId: null,
        sessionTokenHash: null,
        externalVisitorId,
        lastActivityAt: new Date(),
      }),
    )
    return {
      id: session.id,
      agentId: session.agentId,
      appInstallationId,
      externalVisitorId: session.externalVisitorId,
      createdAt: session.createdAt,
    }
  }

  /** A session of this installation and agent, or null: another App's session is not found. */
  findAppSession({
    connectScope,
    appInstallationId,
    agentId,
    sessionId,
  }: {
    connectScope: RequiredConnectScope
    appInstallationId: string
    agentId: string
    sessionId: string
  }): Promise<PublicAgentSession | null> {
    return this.repo().findOne({
      where: {
        id: sessionId,
        organizationId: connectScope.organizationId,
        projectId: connectScope.projectId,
        appInstallationId,
        agentId,
      },
    })
  }

  private repo(): Repository<PublicAgentSession> {
    return this.transactionService.getManager().getRepository(PublicAgentSession)
  }
}
