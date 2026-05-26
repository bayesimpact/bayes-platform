import { Outlet } from "react-router-dom"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { NotFoundRoute } from "@/common/routes/NotFoundRoute"
import { useAppSelector } from "@/common/store/hooks"

export function RestrictedAccess({
  ability,
  children,
}: {
  ability: keyof ReturnType<typeof useAbility>["abilities"]
  children?: React.ReactNode
}) {
  const agentId = useAppSelector(selectCurrentAgentId)
  const projectId = useAppSelector(selectCurrentProjectId)

  const { abilities } = useAbility()

  function build({
    ability,
    agentId,
    projectId,
  }: {
    ability: string
    agentId: string | null
    projectId: string | null
  }) {
    switch (ability) {
      case "canManageAgent":
        return abilities.canManageAgent({ agentId })
      case "canAccessStudio":
        return abilities.canAccessStudio({ projectId })
      case "canAccessTester":
        return abilities.canAccessTester({ projectId })
      case "canAccessReviewer":
        return abilities.canAccessReviewer({ projectId })
      default:
        return false
    }
  }

  const canAccess = build({ ability, agentId, projectId })

  if (canAccess) return <>{children || <Outlet />}</>
  if (!projectId) return <LoadingRoute />
  if (ability === "canManageAgent" && !agentId) return <LoadingRoute />
  return <NotFoundRoute />
}
