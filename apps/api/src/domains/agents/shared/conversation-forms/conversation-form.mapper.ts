import type { ConversationFormDto } from "@caseai-connect/api-contracts"
import type { ConversationForm } from "./conversation-form.entity"

export function toConversationFormDto(
  form: ConversationForm,
  outputJsonSchema?: Record<string, unknown> | null,
): ConversationFormDto {
  return {
    agentId: form.agentId,
    ...(form.agent?.name ? { agentName: form.agent.name } : {}),
    ...(outputJsonSchema ? { outputJsonSchema } : {}),
    agentSettingsId: form.agentSettingsId,
    status: form.status,
    state: form.state,
    ...(form.summary ? { summary: form.summary } : {}),
    updatedAt: form.updatedAt.getTime(),
  }
}
