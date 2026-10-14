import { createContext, useContext } from "react"

export type FormResultEntry = {
  agentId: string
  agentName: string
  outputJsonSchema: Record<string, unknown>
  result?: Record<string, unknown>
}

/**
 * The forms of the conversation, by the agent that fills each one: the
 * session's agent, the sub-agents that took the conversation over, and the
 * relay sub-agents with a form. A reply's "Filling in the form…" step opens
 * the form of the agent that wrote it; the conversation forms sheet lists them
 * all. Null when no agent of the conversation has a form.
 */
export type FormResultContextValue = {
  rootAgentId: string
  byAgentId: Record<string, FormResultEntry>
}

const FormResultContext = createContext<FormResultContextValue | null>(null)

export const FormResultProvider = FormResultContext.Provider

/** The form of the agent that wrote a message (the session's agent when the message names none). */
export function useFormResult(agentId?: string): FormResultEntry | undefined {
  const value = useContext(FormResultContext)
  if (!value) return undefined
  return value.byAgentId[agentId ?? value.rootAgentId]
}

export type ConversationForms = {
  forms: FormResultEntry[]
  /** False when the only form is the session agent's own (filled with fillForm, no delegation). */
  hasSubAgentForms: boolean
}

/** Every form of the conversation, the session's agent first. */
export function listConversationForms(value: FormResultContextValue | null): ConversationForms {
  if (!value) return { forms: [], hasSubAgentForms: false }
  const root = value.byAgentId[value.rootAgentId]
  const others = Object.values(value.byAgentId).filter(
    (entry) => entry.agentId !== value.rootAgentId,
  )
  return { forms: root ? [root, ...others] : others, hasSubAgentForms: others.length > 0 }
}

export function useConversationForms(): ConversationForms {
  return listConversationForms(useContext(FormResultContext))
}
