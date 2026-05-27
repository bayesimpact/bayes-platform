import { selectCurrentFormAgentSessionsData } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "../AsyncRoute"

export function FormAgentRoute({ children }: { children: React.ReactNode }) {
  const agentSessions = useAppSelector(selectCurrentFormAgentSessionsData)
  return <AsyncRoute data={[agentSessions]}>{children}</AsyncRoute>
}
