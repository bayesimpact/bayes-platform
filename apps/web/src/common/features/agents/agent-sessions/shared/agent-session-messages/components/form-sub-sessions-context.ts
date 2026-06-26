import { createContext, useContext } from "react"
import type { FormSubSession } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"

/**
 * Carries the form sub-sessions delegated by the current parent agent session
 * down to the individual tool-call renderers. Defaults to an empty list, so
 * interfaces that don't load sub-sessions (everything outside the Studio) simply
 * render no sub-agent result affordance.
 */
const FormSubSessionsContext = createContext<FormSubSession[]>([])

export const FormSubSessionsProvider = FormSubSessionsContext.Provider

export function useFormSubSessions() {
  return useContext(FormSubSessionsContext)
}
