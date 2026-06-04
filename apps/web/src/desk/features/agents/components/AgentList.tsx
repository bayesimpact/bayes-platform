import { useTranslation } from "react-i18next"
import { useOutlet } from "react-router-dom"
import { Grid, GridContent, GridHeader } from "@/common/components/grid/Grid"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { AgentItem } from "@/common/features/agents/components/AgentItem"
import type { Project } from "@/common/features/projects/projects.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useValue } from "@/common/hooks/use-value"

export function AgentList() {
  const project = useValue(selectCurrentProjectData)
  const agents = useValue(selectAgentsData)
  return <WithData project={project} agents={agents} />
}

function WithData({
  project,
  agents,
  children,
  action,
}: {
  project: Project
  agents: Agent[]
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  const { t } = useTranslation()
  const outlet = useOutlet()

  if (outlet) return outlet
  return (
    <Grid cols={3}>
      <GridHeader title={project.name} description={t("project:project")} action={action} />

      <GridContent>
        {agents.map((agent) => (
          <AgentItem
            key={agent.id}
            organizationId={project.organizationId}
            projectId={agent.projectId}
            agent={agent}
          />
        ))}

        {children}
      </GridContent>
    </Grid>
  )
}
