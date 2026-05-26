import { selectCurrentExtractionAgentSessionsData } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.selectors"
import { extractionAgentSessionsActions } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.slice"
import { useMount } from "@/common/hooks/use-mount"
import { useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "../AsyncRoute"

export function ExtractionAgentRoute({ children }: { children: React.ReactNode }) {
  const agentSessions = useAppSelector(selectCurrentExtractionAgentSessionsData)

  useMount({ actions: extractionAgentSessionsActions })

  return <AsyncRoute data={[agentSessions]}>{children}</AsyncRoute>
}
