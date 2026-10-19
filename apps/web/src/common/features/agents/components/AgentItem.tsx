import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridCard } from "@/common/components/grid/Grid"
import type { Agent } from "@/common/features/agents/agents.models"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { useRoutesBuilder } from "@/common/routes/build-routes/context"
import { buildSince } from "@/common/utils/build-date"

export function AgentItem({
  agent,
  organizationId,
  projectId,
  className,
}: {
  className?: string
  agent: Agent
  organizationId: string
  projectId: string
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { build } = useRoutesBuilder()
  const handleClick = () => {
    const path = build.agentRoute({
      organizationId,
      projectId,
      agentId: agent.id,
    })
    navigate(path)
  }

  const Icon = getAgentIcon(agent.type)

  const date = buildSince(agent.createdAt)
  return (
    <GridCard className={className}>
      <div className="flex items-center gap-1">
        <GridCard.Badge>{t(`agent:create.typeDialog.${agent.type}`)}</GridCard.Badge>
        {/* Only the studio lists an agent that was never published, such as a fresh copy. */}
        {!agent.currentRevision && (
          <GridCard.Badge variant="warning">{t("status:draft")}</GridCard.Badge>
        )}
      </div>
      <GridCard.Body>
        <GridCard.Title>
          <Icon />
          {agent.name}
        </GridCard.Title>
        <GridCard.Description>{date}</GridCard.Description>
        <GridCard.GoButton onClick={handleClick} />
      </GridCard.Body>
    </GridCard>
  )
}
