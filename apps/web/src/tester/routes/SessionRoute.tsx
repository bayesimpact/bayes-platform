import { selectCurrentAgentSessionId } from "@/common/features/agents/agent-sessions/current-agent-session-id/current-agent-session-id.selectors"
import { selectCurrentMessagesData } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppSelector } from "@/common/store/hooks"
import { selectCurrentAgentSession } from "../features/review-campaigns/tester.selectors"
import { reviewCampaignsTesterActions } from "../features/review-campaigns/tester.slice"

export function SessionRoute({ children }: { children: React.ReactNode }) {
  const agentSessionId = useAppSelector(selectCurrentAgentSessionId)
  const messagesData = useAppSelector(selectCurrentMessagesData)
  const agentSession = useAppSelector(selectCurrentAgentSession)

  useMount({
    actions: {
      mount: reviewCampaignsTesterActions.sessionMount,
      unmount: reviewCampaignsTesterActions.sessionUnmount,
    },
    condition: !!agentSessionId,
    refreshOn: [agentSessionId],
  })

  if (!agentSessionId) return <LoadingRoute />
  return <AsyncRoute data={[messagesData, agentSession]}>{children}</AsyncRoute>
}
