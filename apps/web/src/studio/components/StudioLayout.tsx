import { useEffect } from "react"
import { Wrap } from "@/common/components/layouts/Wrap"
import { SidebarAgentList } from "@/common/components/sidebar/list/SidebarAgentList"
import { SidebarLayout } from "@/common/components/sidebar/SidebarLayout"
import { selectMe } from "@/common/features/me/me.selectors"
import { selectCurrentOrganization } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { usePreventLeave } from "@/common/hooks/use-prevent-leave"
import { useValue } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"
import { DotsBackground } from "@/studio/components/DotsBackground"
import { SidebarAgentCreatorButton } from "@/studio/features/agents/components/AgentCreator"
import { selectUploaderState } from "../features/documents/documents.selectors"
import { StudioRoutes } from "../routes/helpers"
import { SidebarFooterChildren } from "../routes/SidebarFooterChildren"

const HELP_SCRIPT_ID = "agentstudio-help-launcher"

export function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = useValue(selectMe)
  const organization = useValue(selectCurrentOrganization)
  const project = useValue(selectCurrentProjectData)

  const uploaderState = useAppSelector(selectUploaderState)
  usePreventLeave(uploaderState.status === "uploading")

  useEffect(() => {
    const token = import.meta.env.VITE_HELP_AGENT_EMBED_TOKEN as string | undefined
    if (!token || document.getElementById(HELP_SCRIPT_ID)) return
    const embedBaseUrl =
      (import.meta.env.VITE_AGENT_EMBED_URL as string | undefined) ?? window.location.origin
    const script = document.createElement("script")
    script.id = HELP_SCRIPT_ID
    script.src = `${embedBaseUrl}/launcher.js`
    const color = import.meta.env.VITE_HELP_AGENT_EMBED_COLOR as string | undefined
    if (color) script.dataset.color = color
    script.dataset.token = token
    document.body.appendChild(script)
  }, [])

  return (
    <SidebarLayout
      organization={organization}
      sidebarContentChildren={
        <SidebarAgentList
          organizationId={organization.id}
          project={project}
          action={<SidebarAgentCreatorButton project={project} />}
        />
      }
      user={{ name: user.name, email: user.email }}
      sidebarFooterChildren={<SidebarFooterChildren project={project} />}
      routes={StudioRoutes}
    >
      <DotsBackground className="flex-1">
        <Wrap>{children}</Wrap>
      </DotsBackground>
    </SidebarLayout>
  )
}
