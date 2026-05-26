import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import {
  selectCurrentProjectData,
  selectCurrentProjectId,
} from "@/common/features/projects/projects.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { AsyncRoute } from "./AsyncRoute"
import { LoadingRoute } from "./LoadingRoute"

export function ProjectRoute({ children }: { children: React.ReactNode }) {
  const projectId = useAppSelector(selectCurrentProjectId)
  const project = useAppSelector(selectCurrentProjectData)
  const agents = useAppSelector(selectAgentsData)

  if (!projectId) return <LoadingRoute />
  return <AsyncRoute data={[agents, project]}>{children}</AsyncRoute>
}
