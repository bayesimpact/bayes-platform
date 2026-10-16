import type {
  AgentMemoryDto,
  AgentMemorySessionTypeDto,
  AgentMemoryToolItemDto,
} from "@caseai-connect/api-contracts"

export type AgentMemory = AgentMemoryDto
export type AgentMemorySessionType = AgentMemorySessionTypeDto
/** A fact as the saveMemory tool call reports it on the assistant message. */
export type AgentMemoryToolItem = AgentMemoryToolItemDto

export type AgentMemoryDecision = {
  memoryId: string
  decision: "save" | "reject"
  content?: string
}
