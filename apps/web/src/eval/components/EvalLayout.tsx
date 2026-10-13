import { HorizontalNavbar } from "@/common/components/sidebar/nav/HorizontalNavbar"
import { agentsActions } from "@/common/features/agents/agents.slice"
import { selectMe } from "@/common/features/me/me.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"

export function EvalLayout({ children }: { children: React.ReactNode }) {
  const user = useValue(selectMe)
  const projectId = useAppSelector(selectCurrentProjectId)

  // The run dialog picks its judge model from the project's catalog.
  useMount({
    actions: {
      mount: agentsActions.mountAvailableModels,
      unmount: agentsActions.unmountAvailableModels,
    },
    condition: !!projectId,
    refreshOn: [projectId],
  })

  return (
    <>
      <HorizontalNavbar user={user} appName="Evaluation" />
      <div className="mx-auto relative border-b">{children}</div>
    </>
  )
}
