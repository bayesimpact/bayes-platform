import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridItem } from "@/common/components/grid/Grid"
import type { Agent } from "@/common/features/agents/agents.models"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { useRoutesBuilder } from "@/common/routes/build-routes/context"
import { buildSince } from "@/common/utils/build-date"

export function AgentItem({
  agent,
  organizationId,
  projectId,
  className,
  index,
}: {
  index: number
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

  const date = buildSince(agent.updatedAt)
  return (
    <GridItem
      className={className}
      badge={t(`agent:create.typeDialog.${agent.type}`)}
      onClick={handleClick}
      title={
        <>
          <Icon />
          {agent.name}
        </>
      }
      description={date}
      index={index}
    />
  )
}
