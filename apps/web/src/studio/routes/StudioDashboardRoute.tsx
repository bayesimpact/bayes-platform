import { Navigate, useOutlet } from "react-router-dom"
import { Wrap } from "@/common/components/layouts/Wrap"
import { SidebarAgentList } from "@/common/components/sidebar/list/SidebarAgentList"
import { SidebarLayout } from "@/common/components/sidebar/SidebarLayout"
import type { User } from "@/common/features/me/me.models"
import type { Organization } from "@/common/features/organizations/organizations.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { usePreventLeave } from "@/common/hooks/use-prevent-leave"
import { RouteNames } from "@/common/routes/helpers"
import { useAppSelector } from "@/common/store/hooks"
import { DotsBackground } from "@/studio/components/DotsBackground"
import { SidebarAgentCreatorButton } from "@/studio/features/agents/components/AgentCreator"
import { selectUploaderState } from "../features/documents/documents.selectors"
import { StudioRoutes } from "./helpers"
import { SidebarFooterChildren } from "./SidebarFooterChildren"

export function StudioDashboardRoute({
  user,
  organization,
}: {
  user: User
  organization: Organization
}) {
  const outlet = useOutlet()
  const project = useAppSelector(selectCurrentProjectData)

  const uploaderState = useAppSelector(selectUploaderState)
  usePreventLeave(uploaderState.status === "uploading")

  return (
    <SidebarLayout
      organization={organization}
      sidebarContentChildren={
        <SidebarAgentList
          organizationId={organization.id}
          project={project.value}
          action={project.value && <SidebarAgentCreatorButton project={project.value} />}
        />
      }
      user={{ name: user.name, email: user.email }}
      sidebarFooterChildren={project.value && <SidebarFooterChildren project={project.value} />}
      routes={StudioRoutes}
    >
      <DotsBackground className="flex-1">
        <Wrap>{outlet ? outlet : <Navigate to={RouteNames.HOME} />}</Wrap>
      </DotsBackground>
    </SidebarLayout>
  )
}
