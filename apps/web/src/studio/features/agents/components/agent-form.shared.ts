import {
  type AgentLocale,
  AgentModel,
  type CreateAgentDto,
  DocumentsRagMode,
  type UpdateAgentDto,
} from "@caseai-connect/api-contracts"
import { useFormContext } from "react-hook-form"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import {
  agentDefaultOutputJsonSchemaMap,
  agentDefaultPromptMap,
} from "./default-agent-values/default-agent-values.helpers"

export type AgentFormData = CreateAgentDto | UpdateAgentDto

/**
 * Wide form values type covering all possible fields from both create and update schemas.
 * Used as the generic for useFormContext in tab components so they can access any field.
 */
export type AgentFormValues = {
  name: string
  locale: AgentLocale
  defaultPrompt: string
  greetingMessage?: string | null
  model: AgentModel
  temperature: number
  outputJsonSchema?: Record<string, unknown>
  documentsRagMode: DocumentsRagMode
  projectAgentSessionCategoryIds: string[]
  tagsToAdd: string[]
  tagsToRemove?: string[]
  documentTagIds?: string[]
  type?: "conversation" | "extraction" | "form"
}

export interface AgentFormBaseProps {
  defaultValues?: AgentFormData
  isLoading: boolean
  error: string | null
  onSubmit: (values: AgentFormData) => Promise<void> | void
  submitLabelIdle: string
  submitLabelLoading: string
}

export function getDefaultFormValues({
  agentType,
  language,
}: {
  agentType: Agent["type"]
  language: AgentLocale
}): AgentFormData {
  const value = {
    type: agentType,
    name: "",
    defaultPrompt: agentDefaultPromptMap[agentType],
    greetingMessage: undefined,
    documentsRagMode: DocumentsRagMode.All,
    model: AgentModel.Gemini25Flash,
    temperature: 0.0,
    locale: language,
    tagsToAdd: [],
    projectAgentSessionCategoryIds: [],
  }

  if (["form", "extraction"].includes(agentType)) {
    // @ts-expect-error - This is valid because of the conditional check on agentType, but TypeScript can't infer that for some reason
    value.outputJsonSchema = agentDefaultOutputJsonSchemaMap[agentType]
  }

  return value
}

export function isValidJsonObject(rawJson: string): boolean {
  try {
    const parsedJson = JSON.parse(rawJson) as unknown
    return typeof parsedJson === "object" && parsedJson !== null && !Array.isArray(parsedJson)
  } catch {
    return false
  }
}

/**
 * Returns the agent type from the form context (create mode, where "type" is part of the schema)
 * or from the Redux store (edit mode, where the current agent is already loaded).
 */
export function useAgentType(): Agent["type"] | undefined {
  const { watch } = useFormContext<AgentFormValues>()
  const agentData = useAppSelector(selectCurrentAgentData)
  return watch("type") ?? (ADS.isFulfilled(agentData) ? agentData.value.type : undefined)
}
