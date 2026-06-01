import { Button } from "@caseai-connect/ui/shad/button"
import { Settings2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useOutlet } from "react-router-dom"
import { Grid, GridContent, GridHeader } from "@/common/components/grid/Grid"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { AgentItem } from "@/common/features/agents/components/AgentItem"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useValue } from "@/common/hooks/use-value"
import { AgentCreatorButton } from "@/studio/features/agents/components/AgentCreator"
import { AnalyticsButton } from "@/studio/features/agents/components/AnalyticsButton"
import { DocumentsButton } from "@/studio/features/agents/components/DocumentsButton"
import { EvaluationButton } from "@/studio/features/agents/components/EvaluationButton"
import { MembersButton } from "@/studio/features/agents/components/MembersButton"
import { ProjectDeletor } from "@/studio/features/projects/components/ProjectDeletor"
import { ReviewCampaignsButton } from "@/studio/features/review-campaigns/components/ReviewCampaignsButton"
import { StudioRoutes } from "@/studio/routes/helpers"

const extraItems = [
  AgentCreatorButton,
  DocumentsButton,
  MembersButton,
  ReviewCampaignsButton,
  AnalyticsButton,
  EvaluationButton,
]

export function AgentList() {
  const project = useValue(selectCurrentProjectData)
  const agents = useValue(selectAgentsData)
  const { t } = useTranslation()
  const outlet = useOutlet()

  if (outlet) return outlet
  return (
    <Grid cols={3} total={agents.length} extraItems={extraItems.length}>
      <GridHeader
        title={project.name}
        description={t("project:project")}
        action={
          <>
            <Button variant="outline" asChild>
              <Link
                to={StudioRoutes.projectAdmin.build({
                  organizationId: project.organizationId,
                  projectId: project.id,
                })}
              >
                <Settings2Icon />
                {t("actions:edit")}
              </Link>
            </Button>
            <ProjectDeletor project={project} />
          </>
        }
      />

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

        {extraItems.map((Component, index) => (
          <Component
            key={`${Component.name}-${index}`}
            project={project}
            index={agents.length + index}
          />
        ))}
      </GridContent>
    </Grid>
  )
}
