import {
  selectCurrentAgentData,
  selectCurrentAgentId,
} from "@/common/features/agents/agents.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "./AsyncRoute"
import { LoadingRoute } from "./LoadingRoute"

export function AgentRoute({ children }: { children: React.ReactNode }) {
  const agentId = useAppSelector(selectCurrentAgentId)
  const agent = useAppSelector(selectCurrentAgentData)
  if (!agentId) return <LoadingRoute />
  return <AsyncRoute data={[agent]}>{children}</AsyncRoute>
}
