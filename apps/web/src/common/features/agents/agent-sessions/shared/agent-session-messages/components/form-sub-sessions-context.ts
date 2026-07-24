import { createContext, useContext } from "react"
import type { ConversationSubSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"

/**
 * Carries the sub-sessions delegated by the current parent agent session down to
 * the individual tool-call renderers. Defaults to an empty list, so interfaces
 * that don't load sub-sessions (everything outside the Studio) simply render no
 * sub-agent result affordance.
 */
const FormSubSessionsContext = createContext<ConversationSubSession[]>([])

export const FormSubSessionsProvider = FormSubSessionsContext.Provider

export function useFormSubSessions() {
  return useContext(FormSubSessionsContext)
}
