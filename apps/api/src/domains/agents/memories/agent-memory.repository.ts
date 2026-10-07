import type { AgentMemoryStatus } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import { In, LessThan, type Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { AgentMemory } from "./agent-memory.entity"

/** Whose memory: one agent, one user, one kind of session. */
export type AgentMemoryOwner = Pick<AgentMemory, "agentId" | "userId" | "sessionType">

export type CreateAgentMemoryFields = Pick<
  AgentMemory,
  "content" | "origin" | "status" | "sourceSessionId"
>

@Injectable()
export class AgentMemoryRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /** Oldest first: the prompt lists facts in the order they were learned. */
  listForOwner(
    connectScope: RequiredConnectScope,
    owner: AgentMemoryOwner,
    statuses: AgentMemoryStatus[],
  ): Promise<AgentMemory[]> {
    return this.connectRepo().find(connectScope, {
      where: { ...owner, status: In(statuses) },
      order: { createdAt: "ASC" },
    })
  }

  findByIdsForOwner(
    connectScope: RequiredConnectScope,
    owner: AgentMemoryOwner,
    ids: string[],
  ): Promise<AgentMemory[]> {
    if (ids.length === 0) return Promise.resolve([])
    return this.connectRepo().find(connectScope, { where: { ...owner, id: In(ids) } })
  }

  async countForOwner(
    connectScope: RequiredConnectScope,
    owner: AgentMemoryOwner,
    status: AgentMemoryStatus,
  ): Promise<number> {
    const [, count] = await this.connectRepo().findAndCount(connectScope, {
      where: { ...owner, status },
    })
    return count
  }

  createMany(
    connectScope: RequiredConnectScope,
    owner: AgentMemoryOwner,
    items: CreateAgentMemoryFields[],
  ): Promise<AgentMemory[]> {
    return this.connectRepo().createAndSaveMany({
      connectScope,
      entities: items.map((item) => ({ ...owner, ...item })),
    })
  }

  async updateOne(
    connectScope: RequiredConnectScope,
    owner: AgentMemoryOwner,
    id: string,
    fields: Partial<Pick<AgentMemory, "content" | "status" | "origin" | "sourceSessionId">>,
  ): Promise<boolean> {
    const affected = await this.connectRepo().updateManyBy({
      connectScope,
      where: { ...owner, id },
      fields,
    })
    return affected === 1
  }

  /** Hard delete: a fact the user rejects or asks to forget must not linger. */
  deleteByIds(
    connectScope: RequiredConnectScope,
    owner: AgentMemoryOwner,
    ids: string[],
  ): Promise<number> {
    if (ids.length === 0) return Promise.resolve(0)
    return this.connectRepo().deleteManyBy({
      connectScope,
      where: { ...owner, id: In(ids) },
      softDelete: false,
    })
  }

  deleteAllForOwner(connectScope: RequiredConnectScope, owner: AgentMemoryOwner): Promise<number> {
    return this.connectRepo().deleteManyBy({ connectScope, where: owner, softDelete: false })
  }

  /**
   * Retention, across every project: saved facts untouched since
   * `savedBefore`, and proposals nobody answered since `pendingBefore`.
   */
  async deleteExpired({
    savedBefore,
    pendingBefore,
  }: {
    savedBefore: Date
    pendingBefore: Date
  }): Promise<number> {
    const [saved, pending] = await Promise.all([
      this.repo().delete({ status: "saved", updatedAt: LessThan(savedBefore) }),
      this.repo().delete({ status: "pending", createdAt: LessThan(pendingBefore) }),
    ])
    return (saved.affected ?? 0) + (pending.affected ?? 0)
  }

  private connectRepo(): ConnectRepository<AgentMemory> {
    return new ConnectRepository(this.repo(), "agentMemory")
  }

  private repo(): Repository<AgentMemory> {
    return this.transactionService.getManager().getRepository(AgentMemory)
  }
}
