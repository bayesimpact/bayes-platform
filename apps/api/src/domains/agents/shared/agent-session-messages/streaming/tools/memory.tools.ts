import {
  AGENT_MEMORY_CONTENT_MAX_LENGTH,
  type AgentMemoryMode,
  type SaveMemoryToolResultDto,
  ToolName,
} from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { SaveMemoryItem } from "@/domains/agents/memories/agent-memories.service"
import type { AgentMemoryOwner } from "@/domains/agents/memories/agent-memory.repository"
import type { AgentSessionScope, OnExecute } from "../streaming-session.types"

/** The slice of AgentMemoriesService the memory tools need. */
export type AgentMemoryToolStore = {
  saveFromTool(params: {
    connectScope: RequiredConnectScope
    owner: AgentMemoryOwner
    memoryMode: AgentMemoryMode
    sourceSessionId: string
    items: SaveMemoryItem[]
  }): Promise<SaveMemoryToolResultDto>
  forget(
    connectScope: RequiredConnectScope,
    owner: AgentMemoryOwner,
    memoryIds: string[],
  ): Promise<number>
}

/**
 * Whose memory a session reads and writes: the signed-in user talking to this
 * agent. Embed visitors and evaluation runs have no user, and review-campaign
 * sessions are test material: none of them get a memory (see ADR 0023).
 */
export function memoryOwnerForSession({
  agent,
  session,
}: Pick<AgentSessionScope, "agent" | "session">): AgentMemoryOwner | null {
  if (!("userId" in session) || !session.userId) return null
  if (session.campaignId) return null
  return { agentId: agent.id, userId: session.userId, sessionType: session.type }
}

/**
 * Facts are shown to the model as m1, m2... and resolved back to ids here,
 * like the resource aliases: the model never handles a uuid.
 */
export type MemoryAliasRegistry = {
  aliasFor: (memoryId: string) => string
  resolve: (alias: string) => string | undefined
}

export function createMemoryAliasRegistry(memoryIds: string[]): MemoryAliasRegistry {
  const aliasById = new Map(memoryIds.map((memoryId, index) => [memoryId, `m${index + 1}`]))
  const idByAlias = new Map([...aliasById].map(([memoryId, alias]) => [alias, memoryId]))
  return {
    aliasFor: (memoryId) => aliasById.get(memoryId) ?? memoryId,
    resolve: (alias) => idByAlias.get(alias.trim()),
  }
}

export function saveMemoryTool({
  connectScope,
  owner,
  memoryMode,
  sourceSessionId,
  memoryStore,
  onExecute,
}: {
  connectScope: RequiredConnectScope
  owner: AgentMemoryOwner
  memoryMode: AgentMemoryMode
  sourceSessionId: string
  memoryStore: AgentMemoryToolStore
  onExecute: OnExecute
}) {
  return tool({
    description: "Remember facts about the user for later conversations.",
    inputSchema: z.object({
      items: z
        .array(
          z.object({
            content: z
              .string()
              .describe(
                `One self-contained fact about the user, under ${AGENT_MEMORY_CONTENT_MAX_LENGTH} characters, written so it makes sense in a later conversation.`,
              ),
            origin: z
              .enum(["user_request", "inferred"])
              .describe(
                "user_request when the user asked you to remember it; inferred when you decided it is worth remembering.",
              ),
          }),
        )
        .min(1)
        .max(5),
    }),
    execute: async ({ items }) => {
      const result = await memoryStore.saveFromTool({
        connectScope,
        owner,
        memoryMode,
        sourceSessionId,
        items,
      })
      await onExecute({ toolName: ToolName.SaveMemory, arguments: { items }, result })
      const saved = result.memories.filter((memory) => memory.status === "saved").length
      const awaitingApproval = result.memories.filter(
        (memory) => memory.status === "pending",
      ).length
      return { saved, awaitingApproval, ...(result.error ? { error: result.error } : {}) }
    },
  })
}

export function forgetMemoryTool({
  connectScope,
  owner,
  aliasRegistry,
  memoryStore,
  onExecute,
}: {
  connectScope: RequiredConnectScope
  owner: AgentMemoryOwner
  aliasRegistry: MemoryAliasRegistry
  memoryStore: AgentMemoryToolStore
  onExecute: OnExecute
}) {
  return tool({
    description: "Forget facts you remembered about the user.",
    inputSchema: z.object({
      memoryIds: z
        .array(z.string())
        .min(1)
        .describe("The ids of the facts to forget, as listed in your memory (m1, m2...)."),
    }),
    execute: async ({ memoryIds }) => {
      const ids = memoryIds
        .map((alias) => aliasRegistry.resolve(alias))
        .filter((memoryId): memoryId is string => memoryId !== undefined)
      const forgotten = await memoryStore.forget(connectScope, owner, ids)
      await onExecute({
        toolName: ToolName.ForgetMemory,
        arguments: { memoryIds },
        result: { forgotten },
      })
      return { forgotten }
    },
  })
}

/** The tool lines of the master prompt, which depend on the agent's memory mode. */
export function saveMemoryInstruction(memoryMode: AgentMemoryMode): string {
  const inferred =
    memoryMode === "ask"
      ? `When you notice a lasting fact or preference worth remembering that the user did not ask you to save, call it with origin "inferred": the user approves or discards it in a form shown under your message, so mention it in one short sentence and do not ask in text.`
      : `When you notice a lasting fact or preference worth remembering, call it with origin "inferred" and mention in one short sentence that you will remember it.`
  return `Remembers facts about the user across conversations. When the user asks you to remember something, call it with origin "user_request". ${inferred} Save only what will help in later conversations (preferences, goals, context the user would otherwise repeat), one fact per item. Never save passwords, credentials, payment details or anything the user asked you not to keep. Do not save a fact already listed in your memory.`
}

export function forgetMemoryInstruction(): string {
  return "Forgets facts listed in your memory, by id. Call it when the user asks you to forget something, or when a fact is outdated (then save the corrected fact)."
}
