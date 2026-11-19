import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { ButtonGroup } from "@caseai-connect/ui/shad/button-group"
import { Settings2Icon, ShieldCheckIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCanReviewConversationsOfAgent } from "@/common/features/me/me.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useAppSelector } from "@/common/store/hooks"
import { AgentMoreActions } from "@/studio/features/agents/components/AgentMoreActions"
import { StudioRoutes } from "@/studio/routes/helpers"

export function AgentActions({ organizationId, agent }: { organizationId: string; agent: Agent }) {
  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agent.id })
  const canDuplicateAgent = abilities.canDuplicateAgent({
    projectId: agent.projectId,
    agentId: agent.id,
  })
  // Safety review is granted agent by agent, whatever the caller's role on the agent.
  const canReviewConversations = useAppSelector(selectCanReviewConversationsOfAgent(agent.id))
  return (
    <>
      {canReviewConversations && (
        <NavConversationReview
          organizationId={organizationId}
          projectId={agent.projectId}
          agentId={agent.id}
        />
      )}

      {canManageAgent && (
        <ButtonGroup>
          <NavAgentEdit organizationId={organizationId} agent={agent} />

          <AgentMoreActions
            organizationId={organizationId}
            agent={agent}
            canDuplicate={canDuplicateAgent}
          />
        </ButtonGroup>
      )}
    </>
  )
}

function NavConversationReview({
  organizationId,
  projectId,
  agentId,
}: {
  organizationId: string
  projectId: string
  agentId: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const path = StudioRoutes.agentConversationReview.build({ organizationId, projectId, agentId })
  return (
    <Button variant="outline" onClick={() => navigate(path)}>
      <ShieldCheckIcon />
      {t("conversationReview:menu")}
    </Button>
  )
}

/**
 * Opens the agent editor. It names the version the editor and the playground work on: the draft
 * when the agent has one, the newest saved version otherwise. That version is green only when it
 * is also the one in production.
 */
function NavAgentEdit({ organizationId, agent }: { organizationId: string; agent: Agent }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const editPath = StudioRoutes.agentEdit.build({
    organizationId,
    projectId: agent.projectId,
    agentId: agent.id,
  })
  const latestSaved = agent.latestSavedRevision ?? agent.currentRevision
  const hasDraft = agent.draftRevision !== undefined || latestSaved === undefined
  const isInProduction = latestSaved?.number === agent.currentRevision?.number
  return (
    <Button variant="outline" onClick={() => navigate(editPath)}>
      <Settings2Icon />
      {t("actions:edit")}
      {hasDraft ? (
        <Badge variant="warning">{t("status:draft")}</Badge>
      ) : (
        <Badge variant={isInProduction ? "success" : "secondary"}>
          {t("agentSettings:history.revisionBadge", { revision: latestSaved?.number })}
        </Badge>
      )}
    </Button>
  )
}
