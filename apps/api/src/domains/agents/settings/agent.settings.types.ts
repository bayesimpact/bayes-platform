import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"

/**
 * Every setting of a revision: the row without the columns that identify it, its agent and its
 * place in the history. A new settings column is part of it without any change here.
 */
export type AgentSettingsFields = Omit<
  AgentSettings,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
  | "organizationId"
  | "projectId"
  | "agentId"
  | "agent"
  | "revision"
  | "revisionName"
  | "revisionDesc"
  | "isDraft"
  | "isArchived"
>

export type AgentSettingsCreateFields = Pick<
  AgentSettings,
  "instructions" | "documentsRagMode" | "model" | "temperature" | "locale"
> &
  Partial<
    Pick<
      AgentSettings,
      | "outputJsonSchema"
      | "greetingMessage"
      | "fillFormEnabled"
      | "priorityCallsEnabled"
      | "thinkingLevel"
      | "memoryMode"
    >
  >

export type AgentSettingsUpdateFields = Partial<
  Pick<
    AgentSettings,
    | "instructions"
    | "greetingMessage"
    | "documentsRagMode"
    | "model"
    | "temperature"
    | "locale"
    | "outputJsonSchema"
    | "fillFormEnabled"
    | "priorityCallsEnabled"
    | "thinkingLevel"
    | "memoryMode"
  >
>
