import { selectCurrentExtractionAgentSessionsData } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.selectors"
import { extractionAgentSessionsActions } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.slice"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "../AsyncRoute"

export function ExtractionAgentSessionsRoute({ children }: { children: React.ReactNode }) {
  const agentId = useCurrentId(selectCurrentAgentId)
  const agentSessions = useAppSelector(selectCurrentExtractionAgentSessionsData)

  useMount({ actions: extractionAgentSessionsActions, refreshOn: [agentId] })

  return <AsyncRoute data={[agentSessions]}>{children}</AsyncRoute>
}
