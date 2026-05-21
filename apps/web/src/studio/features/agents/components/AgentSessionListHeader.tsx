import { cn } from "@caseai-connect/ui/utils"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridContent, GridHeader, GridItem } from "@/common/components/grid/Grid"
import { BaseAgentSessionCreator } from "@/common/features/agents/agent-sessions/shared/base-agent-session/components/BaseAgentSessionCreator"
import type { Agent } from "@/common/features/agents/agents.models"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { useAbility } from "@/common/hooks/use-ability"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useGetAgentRoute, useGetProjectRoute } from "@/common/hooks/use-get-path"
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
  const { hasFeature } = useFeatureFlags()
  const navigate = useNavigate()
  const getAgentRoute = useGetAgentRoute()
  const getProjectRoute = useGetProjectRoute()

  const handleBack = () => {
    const path = backTo === "agent" ? getAgentRoute() : getProjectRoute()
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
    <Grid cols={headerCardCount} total={headerCardCount}>
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
          index={0}
          agent={agent}
          organizationId={organizationId}
          projectId={projectId}
          withBorderBottom={withBorderBottom}
        />

        {showAgentAnalytics && (
          <AgentAnalyticsCard
            agentId={agent.id}
            index={1}
            organizationId={organizationId}
            projectId={projectId}
            withBorderBottom={withBorderBottom}
          />
        )}

        {canManageAgent && (
          <FeedbackButton
            index={showAgentAnalytics ? 2 : 1}
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
  index,
}: {
  index: number
  agent: Agent
  organizationId: string
  projectId: string
  withBorderBottom?: boolean
}) {
  const { t } = useTranslation()
  const prefix = `${agent.type}AgentSession`
  return (
    <GridItem
      className={cn("bg-muted/35", withBorderBottom && "border-b")}
      index={index}
      title={t(`${prefix}:create.title`)}
      description={t(`${prefix}:create.description`)}
      action={
        <BaseAgentSessionCreator
          agentType={agent.type}
          type="button"
          ids={{ organizationId, projectId, agentId: agent.id }}
        />
      }
    />
  )
}
