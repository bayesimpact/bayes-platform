import type { AgentSessionMessageDto } from "@caseai-connect/api-contracts"
import type { AgentSessionMessage } from "../agent-session-messages.models"

// Pure mapper, kept apart from the API module so it can be tested without a
// browser: every DTO field must reach the model (see dto-mappers.spec.ts).
export const fromDto = (dto: AgentSessionMessageDto): AgentSessionMessage => ({
  id: dto.id,
  role: dto.role,
  content: dto.content,
  createdAt: dto.createdAt,
  attachmentDocumentId: dto.attachmentDocumentId,
  status: dto.status,
  startedAt: dto.startedAt,
  completedAt: dto.completedAt,
  agentRevision: dto.agentRevision,
  agentId: dto.agentId,
  toolCalls: dto.toolCalls,
})
