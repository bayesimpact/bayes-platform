import { selectMe } from "@/common/features/me/me.selectors"
import { selectCurrentOrganization } from "@/common/features/organizations/organizations.selectors"
import { selectProjectsData } from "@/common/features/projects/projects.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { organizationsActions } from "../features/organizations/organizations.slice"
import { projectsActions } from "../features/projects/projects.slice"
import { useMount } from "../hooks/use-mount"
import { AsyncRoute } from "./AsyncRoute"

export function OrganizationRoute({ children }: { children: React.ReactNode }) {
  const user = useAppSelector(selectMe)
  const organization = useAppSelector(selectCurrentOrganization)
  const projects = useAppSelector(selectProjectsData)

  useMount({ actions: organizationsActions })
  useMount({ actions: projectsActions, condition: !!organization.value })

  return <AsyncRoute data={[user, projects, organization]}>{children}</AsyncRoute>
}
