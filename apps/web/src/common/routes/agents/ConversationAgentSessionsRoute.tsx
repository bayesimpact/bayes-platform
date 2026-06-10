import { selectCurrentConversationAgentSessionsData } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.selectors"
import { conversationAgentSessionsActions } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.slice"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "../AsyncRoute"

export function ConversationAgentSessionsRoute({ children }: { children: React.ReactNode }) {
  const agentId = useCurrentId(selectCurrentAgentId)
  const agentSessions = useAppSelector(selectCurrentConversationAgentSessionsData)

  useMount({ actions: conversationAgentSessionsActions, refreshOn: [agentId] })

  return <AsyncRoute data={[agentSessions]}>{children}</AsyncRoute>
}
