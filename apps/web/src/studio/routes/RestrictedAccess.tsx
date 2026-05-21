import { Outlet } from "react-router-dom"
import { selectCurrentAgentId } from "@/common/features/agents/agents.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { NotFoundRoute } from "@/common/routes/NotFoundRoute"
import { useAppSelector } from "@/common/store/hooks"

export function RestrictedAccess({
  ability,
  children,
}: {
  ability: "canManageAgent" | "canAccessStudio"
  children?: React.ReactNode
}) {
  const agentId = useAppSelector(selectCurrentAgentId)
  const projectId = useAppSelector(selectCurrentProjectId)

  const { abilities } = useAbility()
  const canAccess = abilities[ability]({ agentId, projectId })

  if (canAccess) return <>{children || <Outlet />}</>
  return <NotFoundRoute />
}
