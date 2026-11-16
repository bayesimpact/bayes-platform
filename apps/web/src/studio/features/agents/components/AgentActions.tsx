import { Button } from "@caseai-connect/ui/shad/button"
import { ButtonGroup } from "@caseai-connect/ui/shad/button-group"
import { ExternalLinkIcon, PenLineIcon, ShieldCheckIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCanReviewConversationsOfAgent } from "@/common/features/me/me.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { DeskRoutes } from "@/common/routes/desk-routes"
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
      {/* The app only lists published agents: a fresh copy appears there once published. */}
      {agent.currentRevision && (
        <NavApp organizationId={organizationId} projectId={agent.projectId} agentId={agent.id} />
      )}

      {canReviewConversations && (
        <NavConversationReview
          organizationId={organizationId}
          projectId={agent.projectId}
          agentId={agent.id}
        />
      )}

      {canManageAgent && (
        <ButtonGroup>
          <NavAgentEdit
            organizationId={organizationId}
            projectId={agent.projectId}
            agentId={agent.id}
          />

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

function NavApp({
  organizationId,
  projectId,
  agentId,
}: {
  organizationId: string
  projectId: string
  agentId: string
}) {
  const { t } = useTranslation()
  const deskAgentPath = DeskRoutes.agent.build({ organizationId, projectId, agentId })
  return (
    <Button variant="secondary" asChild>
      <a target="_blank" rel="noopener noreferrer" href={deskAgentPath}>
        <ExternalLinkIcon />
        {t("agent:goToProductionApp")}
      </a>
    </Button>
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

function NavAgentEdit({
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
  const editPath = StudioRoutes.agentEdit.build({ organizationId, projectId, agentId })
  const handleClick = () => navigate(editPath)
  return (
    <Button variant="outline" onClick={handleClick}>
      <PenLineIcon />
      {t("actions:edit")}
    </Button>
  )
}
