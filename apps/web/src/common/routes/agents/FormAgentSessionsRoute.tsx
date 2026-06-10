import { selectCurrentFormAgentSessionsData } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.selectors"
import { formAgentSessionsActions } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.slice"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useCurrentId } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "../AsyncRoute"

export function FormAgentSessionsRoute({ children }: { children: React.ReactNode }) {
  const agentId = useCurrentId(selectCurrentAgentId)
  const agentSessions = useAppSelector(selectCurrentFormAgentSessionsData)

  useMount({ actions: formAgentSessionsActions, refreshOn: [agentId] })

  return <AsyncRoute data={[agentSessions]}>{children}</AsyncRoute>
}
