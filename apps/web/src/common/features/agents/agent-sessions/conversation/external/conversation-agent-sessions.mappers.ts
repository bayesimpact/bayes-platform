import type {
  ConversationAgentSessionDto,
  ConversationSubSessionDto,
} from "@caseai-connect/api-contracts"
import type {
  ConversationAgentSession,
  ConversationSubSession,
} from "../conversation-agent-sessions.models"

// Pure mappers, kept apart from the API module so they can be tested without a
// browser: every DTO field must reach the model (see dto-mappers.spec.ts).

export const fromDto = (dto: ConversationAgentSessionDto): ConversationAgentSession => ({
  id: dto.id,
  agentId: dto.agentId,
  type: dto.type,
  title: dto.title,
  createdAt: dto.createdAt,
  updatedAt: dto.updatedAt,
  traceUrl: dto.traceUrl,
  forms: dto.forms,
  activeAgentId: dto.activeAgentId,
})

export const fromSubSessionDto = (dto: ConversationSubSessionDto): ConversationSubSession => ({
  toolName: dto.toolName,
  agentId: dto.agentId,
  agentName: dto.agentName,
  outputJsonSchema: dto.outputJsonSchema,
  session: fromDto(dto.session),
})
