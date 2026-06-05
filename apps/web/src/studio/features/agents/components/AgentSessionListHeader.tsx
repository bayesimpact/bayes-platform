import { cn } from "@caseai-connect/ui/utils"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import { BaseAgentSessionCreator } from "@/common/features/agents/agent-sessions/shared/base-agent-session/components/BaseAgentSessionCreator"
import type { Agent } from "@/common/features/agents/agents.models"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useGetAgentRoute, useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { AgentActions } from "./AgentActions"
import { AgentAnalyticsCard } from "./AgentAnalyticsCard"
import { FeedbackButton } from "./FeedbackButton"

export function AgentSessionListHeader({
  agent,
  withBorderBottom,
  backTo,
  projectId,
  organizationId,
}: {
  projectId: string
  organizationId: string
  agent: Agent
  withBorderBottom: boolean
  backTo: "agent" | "project"
}) {
  const { t } = useTranslation()
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  const navigate = useNavigate()
  const agentRoute = useGetAgentRoute()
  const projectRoute = useGetProjectRoute()

  const handleBack = () => {
    const path = backTo === "agent" ? agentRoute : projectRoute
    navigate(path)
  }

  const Icon = getAgentIcon(agent.type)

  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agent.id })

  const showAgentAnalytics =
    canManageAgent && agent.type === "conversation" && hasFeature("project-analytics")

  const headerCardCount = (1 + // Create Session button
    (showAgentAnalytics ? 1 : 0) +
    (canManageAgent ? 1 : 0)) as 1 | 2 | 3
  return (
    <Grid cols={headerCardCount}>
      <GridHeader
        onBack={handleBack}
        title={agent.name}
        description={
          <>
            <div className="capitalize-first">{t(`agent:create.typeDialog.${agent.type}`)}</div>
            <Icon />
          </>
        }
        action={
          canManageAgent ? <AgentActions agent={agent} organizationId={organizationId} /> : null
        }
      />

      <GridContent>
        <CreateSessionButton
          agent={agent}
          organizationId={organizationId}
          projectId={projectId}
          withBorderBottom={withBorderBottom}
        />

        {showAgentAnalytics && (
          <AgentAnalyticsCard
            agentId={agent.id}
            organizationId={organizationId}
            projectId={projectId}
            withBorderBottom={withBorderBottom}
          />
        )}

        {canManageAgent && (
          <FeedbackButton
            agentId={agent.id}
            organizationId={organizationId}
            projectId={projectId}
            withBorderBottom={withBorderBottom}
          />
        )}
      </GridContent>
    </Grid>
  )
}

function CreateSessionButton({
  agent,
  organizationId,
  projectId,
  withBorderBottom,
}: {
  agent: Agent
  organizationId: string
  projectId: string
  withBorderBottom?: boolean
}) {
  const { t } = useTranslation()
  const prefix = `${agent.type}AgentSession`
  return (
    <GridCard className={cn("bg-muted/35", withBorderBottom && "border-b")}>
      <GridCard.Body>
        <GridCard.Title>{t(`${prefix}:create.title`)}</GridCard.Title>
        <GridCard.Description>{t(`${prefix}:create.description`)}</GridCard.Description>
        <BaseAgentSessionCreator
          agentType={agent.type}
          type="button"
          ids={{ organizationId, projectId, agentId: agent.id }}
        />
      </GridCard.Body>
    </GridCard>
  )
}
