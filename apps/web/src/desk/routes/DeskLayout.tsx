import { SidebarMenuButton } from "@caseai-connect/ui/shad/sidebar"
import { ExternalLinkIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"
import { Wrap } from "@/common/components/layouts/Wrap"
import { SidebarAgentList } from "@/common/components/sidebar/list/SidebarAgentList"
import { SidebarLayout } from "@/common/components/sidebar/SidebarLayout"
import { selectMe } from "@/common/features/me/me.selectors"
import { selectCurrentOrganization } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useValue } from "@/common/hooks/use-value"
import { StudioRoutes } from "@/studio/routes/helpers"
import { DeskRoutes } from "./helpers"

export function DeskLayout({ children }: { children: React.ReactNode }) {
  const user = useValue(selectMe)
  const organization = useValue(selectCurrentOrganization)
  const project = useValue(selectCurrentProjectData)

  return (
    <SidebarLayout
      organization={organization}
      sidebarContentChildren={
        <SidebarAgentList organizationId={organization.id} project={project} />
      }
      user={{ name: user.name, email: user.email }}
      sidebarFooterChildren={<SidebarFooterChildren projectId={project.id} />}
      routes={DeskRoutes}
    >
      <Wrap>{children}</Wrap>
    </SidebarLayout>
  )
}

function SidebarFooterChildren({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const { abilities } = useAbility()
  const location = useLocation()

  const studioPath = location.pathname.replace(DeskRoutes.home.path, StudioRoutes.home.path)

  if (!abilities.canAccessStudio({ projectId })) return null
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
