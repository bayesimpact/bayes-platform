import {
  AGENT_MEMORY_CONTENT_MAX_LENGTH,
  AGENT_MEMORY_MAX_SAVED_PER_USER,
  AgentMemoryMode,
  type AgentMemoryOrigin,
  type AgentMemoryToolItemDto,
  type ResolveAgentMemoryProposalsDto,
  type SaveMemoryToolResultDto,
} from "@caseai-connect/api-contracts"
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import {
  AGENT_MEMORY_MAX_PENDING_PER_USER,
  AGENT_MEMORY_PENDING_RETENTION_DAYS,
  AGENT_MEMORY_SAVED_RETENTION_DAYS,
} from "./agent-memory.constants"
import type { AgentMemory } from "./agent-memory.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { type AgentMemoryOwner, AgentMemoryRepository } from "./agent-memory.repository"

const DAY_MS = 24 * 60 * 60 * 1000

export type SaveMemoryItem = { content: string; origin: AgentMemoryOrigin }

/**
 * What a conversation agent remembers about a user (see ADR 0023): the facts
 * its tools save and forget, the proposals the user approves, and the list the
 * user manages from the conversation view.
 */
@Injectable()
export class AgentMemoriesService {
  constructor(
    private readonly agentMemoryRepository: AgentMemoryRepository,
    private readonly transactionService: TransactionService,
  ) {}

  /** Saved facts and pending proposals, oldest first. */
  listForOwner(
    connectScope: RequiredConnectScope,
    owner: AgentMemoryOwner,
  ): Promise<AgentMemory[]> {
    return this.agentMemoryRepository.listForOwner(connectScope, owner, ["saved", "pending"])
  }

  /**
   * The saveMemory tool. In `ask` mode, a fact the agent inferred becomes a
   * proposal the user approves under the message; a fact the user asked to
   * remember is saved at once. Over the caps, the extra items are refused and
   * the model is told why, so it can forget something first.
   */
  async saveFromTool({
    connectScope,
    owner,
    memoryMode,
    sourceSessionId,
    items,
  }: {
    connectScope: RequiredConnectScope
    owner: AgentMemoryOwner
    memoryMode: AgentMemoryMode
    sourceSessionId: string
    items: SaveMemoryItem[]
  }): Promise<SaveMemoryToolResultDto> {
    if (memoryMode === AgentMemoryMode.Off) return { memories: [], error: "Memory is turned off." }

    const errors: string[] = []
    const cleanItems = items
      .map((item) => ({ ...item, content: item.content.trim() }))
      .filter((item) => {
        if (item.content.length === 0) return false
        if (item.content.length > AGENT_MEMORY_CONTENT_MAX_LENGTH) {
          errors.push(
            `"${item.content.slice(0, 40)}…" is too long: keep each fact under ${AGENT_MEMORY_CONTENT_MAX_LENGTH} characters.`,
          )
          return false
        }
        return true
      })

    const created = await this.transactionService.run(async () => {
      const [savedCount, pendingCount, existing] = await Promise.all([
        this.agentMemoryRepository.countForOwner(connectScope, owner, "saved"),
        this.agentMemoryRepository.countForOwner(connectScope, owner, "pending"),
        this.agentMemoryRepository.listForOwner(connectScope, owner, ["saved", "pending"]),
      ])
      const knownContents = new Set(existing.map((memory) => normalize(memory.content)))
      let savedRoom = AGENT_MEMORY_MAX_SAVED_PER_USER - savedCount
      let pendingRoom = AGENT_MEMORY_MAX_PENDING_PER_USER - pendingCount

      const toCreate = cleanItems.flatMap((item) => {
        // The same fact said twice is already remembered: nothing to add.
        if (knownContents.has(normalize(item.content))) return []
        knownContents.add(normalize(item.content))
        const status =
          item.origin === "inferred" && memoryMode === AgentMemoryMode.Ask ? "pending" : "saved"
        if (status === "saved" && savedRoom <= 0) {
          errors.push(
            `Memory is full (${AGENT_MEMORY_MAX_SAVED_PER_USER} facts): forget an outdated fact before saving "${item.content.slice(0, 40)}…".`,
          )
          return []
        }
        if (status === "pending" && pendingRoom <= 0) {
          errors.push("Too many facts are waiting for the user's approval: wait for their answer.")
          return []
        }
        if (status === "saved") savedRoom--
        else pendingRoom--
        return [{ content: item.content, origin: item.origin, status, sourceSessionId } as const]
      })
      return this.agentMemoryRepository.createMany(connectScope, owner, toCreate)
    })

    return {
      memories: created.map(toToolItem),
      ...(errors.length > 0 ? { error: errors.join(" ") } : {}),
    }
  }

  /** The forgetMemory tool, and the user's delete button: the facts are deleted, not hidden. */
  forget(
    connectScope: RequiredConnectScope,
    owner: AgentMemoryOwner,
    memoryIds: string[],
  ): Promise<number> {
    return this.agentMemoryRepository.deleteByIds(connectScope, owner, memoryIds)
  }

  async deleteOne(
    connectScope: RequiredConnectScope,
    owner: AgentMemoryOwner,
    memoryId: string,
  ): Promise<void> {
    const deleted = await this.forget(connectScope, owner, [memoryId])
    if (deleted === 0) throw new NotFoundException("Memory not found")
  }

  deleteAll(connectScope: RequiredConnectScope, owner: AgentMemoryOwner): Promise<number> {
    return this.agentMemoryRepository.deleteAllForOwner(connectScope, owner)
  }

  /**
   * The user's answer to the approval form: each proposal is saved (possibly
   * reworded) or deleted. Only the caller's own pending proposals qualify.
   * Returns the facts saved by this answer.
   */
  async resolveProposals(
    connectScope: RequiredConnectScope,
    owner: AgentMemoryOwner,
    { decisions }: ResolveAgentMemoryProposalsDto,
  ): Promise<AgentMemory[]> {
    return this.transactionService.run(async () => {
      const memoryIds = decisions.map((decision) => decision.memoryId)
      const proposals = await this.agentMemoryRepository.findByIdsForOwner(
        connectScope,
        owner,
        memoryIds,
      )
      const pendingById = new Map(
        proposals
          .filter((proposal) => proposal.status === "pending")
          .map((proposal) => [proposal.id, proposal]),
      )
      if (decisions.some((decision) => !pendingById.has(decision.memoryId))) {
        throw new NotFoundException("Memory proposal not found or already answered")
      }

      const toSave = decisions.filter((decision) => decision.decision === "save")
      const savedCount = await this.agentMemoryRepository.countForOwner(
        connectScope,
        owner,
        "saved",
      )
      if (savedCount + toSave.length > AGENT_MEMORY_MAX_SAVED_PER_USER) {
        throw new BadRequestException(
          `Memory is full (${AGENT_MEMORY_MAX_SAVED_PER_USER} facts): delete some facts first.`,
        )
      }

      await this.agentMemoryRepository.deleteByIds(
        connectScope,
        owner,
        decisions
          .filter((decision) => decision.decision === "reject")
          .map((decision) => decision.memoryId),
      )
      for (const decision of toSave) {
        await this.agentMemoryRepository.updateOne(connectScope, owner, decision.memoryId, {
          status: "saved",
          ...(decision.content ? { content: decision.content } : {}),
        })
      }
      return this.agentMemoryRepository.findByIdsForOwner(
        connectScope,
        owner,
        toSave.map((decision) => decision.memoryId),
      )
    })
  }

  /** Nightly retention: memory outlives conversations, but not forever. */
  deleteExpired(now: Date = new Date()): Promise<number> {
    return this.agentMemoryRepository.deleteExpired({
      savedBefore: new Date(now.getTime() - AGENT_MEMORY_SAVED_RETENTION_DAYS * DAY_MS),
      pendingBefore: new Date(now.getTime() - AGENT_MEMORY_PENDING_RETENTION_DAYS * DAY_MS),
    })
  }
}

function normalize(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, " ")
}

function toToolItem(memory: AgentMemory): AgentMemoryToolItemDto {
  return { id: memory.id, content: memory.content, status: memory.status }
}
