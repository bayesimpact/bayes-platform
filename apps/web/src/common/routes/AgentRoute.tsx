import {
  selectCurrentAgentData,
  selectCurrentAgentId,
} from "@/common/features/agents/agents.selectors"
import { agentSettingsActions } from "@/common/features/agents/settings/agent-settings.slice"
import { useMount } from "@/common/hooks/use-mount"
import { useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "./AsyncRoute"
import { LoadingRoute } from "./LoadingRoute"

export function AgentRoute({
  children,
  loadSettings = false,
}: {
  children: React.ReactNode
  /**
   * Load the agent's settings revisions for this subtree. Studio only: the Desk scope never
   * displays them, and the settings endpoint requires agent membership, so requesting them
   * there would 403 for a project member who is not a member of the agent.
   */
  loadSettings?: boolean
}) {
  const agentId = useAppSelector(selectCurrentAgentId)
  const agent = useAppSelector(selectCurrentAgentData)

  // Single owner of the agent's settings revisions for Studio's `agent.path` subtree: the
  // editor, the extraction session list's inline editor, and the conversation playground header
  // all read the same slot. The route stays mounted while the current agent changes, so the load
  // re-runs on the agent id.
  //
  // Deliberately outside the `AsyncRoute` gate below: revisions only feed secondary UI, and
  // blocking on them would delay the session list for every visitor. Consumers honour the
  // single-slot staleness rule from `agent-settings.selectors.ts` instead.
  useMount({
    actions: agentSettingsActions,
    condition: loadSettings && Boolean(agentId),
    refreshOn: [agentId],
  })

  if (!agentId) return <LoadingRoute />
  return <AsyncRoute data={[agent]}>{children}</AsyncRoute>
}
