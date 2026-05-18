import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarSeparator,
} from "@caseai-connect/ui/shad/sidebar"
import { useTranslation } from "react-i18next"
import { useParams } from "react-router-dom"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import type { Project } from "@/common/features/projects/projects.models"
import { useRoutesBuilder } from "@/common/routes/build-routes/context"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import { AppNavItem } from "../nav/NavItem"
import { SidebarAgentSessionList } from "./SidebarAgentSessionList"

export function SidebarAgentList({
  organizationId,
  project,
  action,
}: {
  project: Project | null
  organizationId: string
  action?: React.ReactNode
}) {
  const agents = useAppSelector(selectAgentsData)

  if (!ADS.isFulfilled(agents) || !project) return null

  return (
    <WithData
      action={action}
      organizationId={organizationId}
      project={project}
      agents={agents.value}
    />
  )
}

function WithData({
  organizationId,
  project,
  agents,
  action,
}: {
  organizationId: string
  project: Project
  agents: Agent[]
  action?: React.ReactNode
}) {
  const { t } = useTranslation()
  const { agentId: urlagentId } = useParams()

  const { build } = useRoutesBuilder()
  return (
    <SidebarGroup>
      <div className="flex items-center gap-2">
        <SidebarGroupLabel className="uppercase flex-1">
          {t(agents.length === 1 ? "agent:agent" : "agent:agents")}
        </SidebarGroupLabel>
        {action}
      </div>

      <SidebarGroupContent>
        {agents.map((agent) => (
          <SidebarMenu key={agent.id}>
            <AppNavItem
              item={{
                id: agent.id,
                title: agent.name,
                url: build.agentRoute({ organizationId, projectId: project.id, agentId: agent.id }),
                isActive: urlagentId === agent.id,
                icon: getAgentIcon(agent.type),
              }}
            >
              {agent.type !== "extraction" && (
                <SidebarAgentSessionList
                  organizationId={organizationId}
                  projectId={project.id}
                  agentId={agent.id}
                  agentType={agent.type}
                />
              )}
            </AppNavItem>

            <div className="mr-4 mb-2 mt-1">
              <SidebarSeparator />
            </div>
          </SidebarMenu>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
