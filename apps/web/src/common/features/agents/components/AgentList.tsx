import { useTranslation } from "react-i18next"
import { useOutlet } from "react-router-dom"
import { Grid, GridContent, GridHeader } from "@/common/components/grid/Grid"
import type { Agent } from "@/common/features/agents/agents.models"
import { AgentItem } from "@/common/features/agents/components/AgentItem"
import type { Project } from "@/common/features/projects/projects.models"

export function AgentList({
  project,
  agents,
  children,
  action,
  extraItems,
}: {
  project: Project
  agents: Agent[]
  children?: React.ReactNode
  action?: React.ReactNode
  extraItems?: number
}) {
  const { t } = useTranslation()
  const outlet = useOutlet()

  if (outlet) return outlet
  return (
    <Grid cols={3} total={agents.length} extraItems={extraItems}>
      <GridHeader title={project.name} description={t("project:project")} action={action} />

      <GridContent>
        {agents.map((agent, index) => (
          <AgentItem
            index={index}
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
