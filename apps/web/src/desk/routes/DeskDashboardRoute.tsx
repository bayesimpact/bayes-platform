import { SidebarMenuButton } from "@caseai-connect/ui/shad/sidebar"
import { ExternalLinkIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Navigate, useLocation, useOutlet } from "react-router-dom"
import { Wrap } from "@/common/components/layouts/Wrap"
import { SidebarAgentList } from "@/common/components/sidebar/list/SidebarAgentList"
import { SidebarLayout } from "@/common/components/sidebar/SidebarLayout"
import type { User } from "@/common/features/me/me.models"
import type { Organization } from "@/common/features/organizations/organizations.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { RouteNames } from "@/common/routes/helpers"
import { useAppSelector } from "@/common/store/hooks"
import { StudioRoutes } from "@/studio/routes/helpers"
import { DeskRoutes } from "./helpers"

export function DeskDashboardRoute({
  user,
  organization,
}: {
  user: User
  organization: Organization
}) {
  const outlet = useOutlet()
  const project = useAppSelector(selectCurrentProjectData)

  return (
    <SidebarLayout
      organization={organization}
      sidebarContentChildren={
        <SidebarAgentList organizationId={organization.id} project={project.value} />
      }
      user={{ name: user.name, email: user.email }}
      sidebarFooterChildren={<SidebarFooterChildren projectId={project.value?.id} />}
      routes={DeskRoutes}
    >
      <Wrap>{outlet ? outlet : <Navigate to={RouteNames.HOME} />}</Wrap>
    </SidebarLayout>
  )
}

function SidebarFooterChildren({ projectId }: { projectId?: string }) {
  const { t } = useTranslation()
  const { abilities } = useAbility()
  const location = useLocation()

  const studioPath = location.pathname.replace(DeskRoutes.home.path, StudioRoutes.home.path)

  if (!projectId || !abilities.canAccessStudio({ projectId })) return null
  return (
    <SidebarMenuButton
      variant="outline"
      className="bg-primary hover:bg-primary/90 text-white hover:text-white active:bg-primary/80 active:text-white"
      asChild
    >
      <a
        target="_blank"
        className="text-center w-full flex items-center justify-center"
        rel="noopener noreferrer"
        href={studioPath}
      >
        <ExternalLinkIcon />
        {t("actions:goToStudio")}
      </a>
    </SidebarMenuButton>
  )
}
