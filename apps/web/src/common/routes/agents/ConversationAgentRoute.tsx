import { selectCurrentConversationAgentSessionsData } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "../AsyncRoute"

export function ConversationAgentRoute({ children }: { children: React.ReactNode }) {
  const agentSessions = useAppSelector(selectCurrentConversationAgentSessionsData)

  return <AsyncRoute data={[agentSessions]}>{children}</AsyncRoute>
}
