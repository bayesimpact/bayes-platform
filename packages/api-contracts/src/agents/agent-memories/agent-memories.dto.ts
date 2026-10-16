import { z } from "zod"
import type { TimeType } from "../../generic"
import type { BaseAgentSessionTypeDto } from "../conversation-agent-sessions/conversation-agent-sessions.dto"

/** Longest fact an agent can remember, in characters. */
export const AGENT_MEMORY_CONTENT_MAX_LENGTH = 300

/** Most facts an agent keeps about one user (per session type). */
export const AGENT_MEMORY_MAX_SAVED_PER_USER = 50

/** Whether the user asked the agent to remember the fact, or the agent noticed it. */
export type AgentMemoryOrigin = "user_request" | "inferred"

/**
 * A proposal waits for the user's approval (`pending`); approved facts are
 * `saved`. A rejected or forgotten fact is deleted, not kept with a status.
 */
export type AgentMemoryStatus = "pending" | "saved"

/**
 * Playground and live conversations keep separate memories, so a builder's
 * tests never leak into what the agent remembers about real users.
 */
export type AgentMemorySessionTypeDto = BaseAgentSessionTypeDto

export type AgentMemoryDto = {
  id: string
  content: string
  origin: AgentMemoryOrigin
  status: AgentMemoryStatus
  sourceSessionId: string | null
  createdAt: TimeType
  updatedAt: TimeType
}

/** One saved or proposed fact, as the saveMemory tool reports it on the tool call. */
export type AgentMemoryToolItemDto = {
  id: string
  content: string
  status: AgentMemoryStatus
}

/** The `result` the saveMemory tool stores on its tool call. */
export type SaveMemoryToolResultDto = {
  memories: AgentMemoryToolItemDto[]
  error?: string
}

export const agentMemoryContentSchema = z
  .string()
  .trim()
  .min(1)
  .max(AGENT_MEMORY_CONTENT_MAX_LENGTH)

export const resolveAgentMemoryProposalsSchema = z.object({
  decisions: z
    .array(
      z.object({
        memoryId: z.string().uuid(),
        decision: z.enum(["save", "reject"]),
        // The user may reword a proposal before saving it.
        content: agentMemoryContentSchema.optional(),
      }),
    )
    .min(1)
    .max(20),
})
export type ResolveAgentMemoryProposalsDto = z.infer<typeof resolveAgentMemoryProposalsSchema>
