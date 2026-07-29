import { selectCurrentExtractionAgentSessionsData } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.selectors"
import { extractionAgentSessionsActions } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.slice"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "../AsyncRoute"

// Neither scope loads agent settings here: Studio's `ExtractionAgentSessionList` reads them from
// the single slot `AgentRoute` loads for the whole `agent.path` subtree, and Desk's own
// `ExtractionAgentSessionList` (in `desk/features/agents/components/AgentSessionList.tsx`) has no
// inline editor and never reads the settings selectors, so Desk has nothing to load them for.
export function ExtractionAgentSessionsRoute({ children }: { children: React.ReactNode }) {
  const agentId = useCurrentId(selectCurrentAgentId)
  const agentSessions = useAppSelector(selectCurrentExtractionAgentSessionsData)

  useMount({ actions: extractionAgentSessionsActions, refreshOn: [agentId] })

  return <AsyncRoute data={[agentSessions]}>{children}</AsyncRoute>
}
