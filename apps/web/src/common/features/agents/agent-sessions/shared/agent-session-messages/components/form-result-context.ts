import { createContext, useContext } from "react"

export type FormResultEntry = {
  outputJsonSchema: Record<string, unknown>
  result?: Record<string, unknown>
}

/**
 * The forms of the conversation, by the agent that fills each one: the
 * session's agent, and every sub-agent that took the conversation over. A
 * reply's "Filling in the form…" step opens the form of the agent that wrote
 * it. Null when no agent of the conversation has a form.
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
