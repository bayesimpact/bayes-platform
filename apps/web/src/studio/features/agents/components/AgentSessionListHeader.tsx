import { cn } from "@bayes-platform/ui/utils"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import type { Agent } from "@/common/features/agents/agents.models"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { selectCanReviewConversationsOfAgent } from "@/common/features/me/me.selectors"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useGetAgentRoute, useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"
import { AgentProductionBar } from "../agent-settings/components/AgentProductionBar"
import { AgentActions } from "./AgentActions"
import { AgentAnalyticsCard } from "./AgentAnalyticsCard"
import { AgentEvaluationCard, AgentProductionAppCard } from "./AgentExternalAppCard"
import { AgentMembersCard } from "./AgentMembersCard"
import { FeedbackButton } from "./FeedbackButton"
import { PlaygroundAgentSessionCreator } from "./PlaygroundAgentSessionCreator"

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

  // Safety review is granted agent by agent, so its menu entry shows even without an agent role.
  const canReviewConversations = useAppSelector(selectCanReviewConversationsOfAgent(agent.id))
  const showAgentActions = canManageAgent || canReviewConversations

  const canOpenEvaluation = abilities.canAccessEvaluation({ projectId })
  // The app only lists published agents: a fresh copy appears there once published.
  const isPublished = agent.currentRevision !== undefined

  const headerCards =
    1 + // Create Session button
    (showAgentAnalytics ? 1 : 0) +
    (canManageAgent ? 2 : 0) + // Feedback and Members
    (canOpenEvaluation ? 1 : 0) +
    (isPublished ? 1 : 0) // App (production)
  // Three cards a row at most: beyond that they wrap to a second row, and the grid stretches
  // the last one to fill it. Five in one row left no room for their text.
  const headerCardCount = Math.min(headerCards, 3) as 1 | 2 | 3
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
          showAgentActions ? <AgentActions agent={agent} organizationId={organizationId} /> : null
        }
      />

      <AgentProductionBar agent={agent} />

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

        {agent.currentRevision && (
          <AgentProductionAppCard
            agentId={agent.id}
            productionRevision={agent.currentRevision.number}
            organizationId={organizationId}
            projectId={projectId}
            withBorderBottom={withBorderBottom}
          />
        )}

        {canOpenEvaluation && (
          <AgentEvaluationCard
            agentType={agent.type}
            organizationId={organizationId}
            projectId={projectId}
            withBorderBottom={withBorderBottom}
          />
        )}

        {canManageAgent && (
          <AgentMembersCard
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
        <PlaygroundAgentSessionCreator
          agentType={agent.type}
          type="button"
          ids={{ organizationId, projectId, agentId: agent.id }}
        />
      </GridCard.Body>
    </GridCard>
  )
}
