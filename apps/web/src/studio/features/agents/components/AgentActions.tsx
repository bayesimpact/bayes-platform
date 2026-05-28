import { Button } from "@caseai-connect/ui/shad/button"
import { ExternalLinkIcon, PenLineIcon, UsersIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import type { Agent } from "@/common/features/agents/agents.models"
import { useAbility } from "@/common/hooks/use-ability"
import { DeskRoutes } from "@/desk/routes/helpers"
import { AgentDeletorWithTrigger } from "@/studio/features/agents/components/AgentDeletor"
import { StudioRoutes } from "@/studio/routes/helpers"

export function AgentActions({ organizationId, agent }: { organizationId: string; agent: Agent }) {
  const { t } = useTranslation()

  const deskAgentPath = DeskRoutes.agent.build({
    organizationId,
    projectId: agent.projectId,
    agentId: agent.id,
  })

  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agent.id })
  const editPath = StudioRoutes.agentEdit.build({
    organizationId,
    projectId: agent.projectId,
    agentId: agent.id,
  })
  const navigate = useNavigate()
  return (
    <>
      <Button variant="secondary" asChild>
        <a target="_blank" rel="noopener noreferrer" href={deskAgentPath}>
          <ExternalLinkIcon />
          {t("actions:goToApp")}
        </a>
      </Button>

      {canManageAgent && (
        <>
          <NavAgentMemberships
            organizationId={organizationId}
            projectId={agent.projectId}
            agentId={agent.id}
          />

          {agent.type !== "extraction" && (
            <Button variant="outline" onClick={() => navigate(editPath)}>
              <PenLineIcon />
              {t("actions:edit")}
            </Button>
          )}

          <AgentDeletorWithTrigger organizationId={organizationId} agent={agent} />
        </>
      )}
    </>
  )
}

function NavAgentMemberships({
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
  const path = StudioRoutes.agentMemberships.build({ organizationId, projectId, agentId })
  const handleClick = () => navigate(path)
  return (
    <Button variant="outline" size="lg" onClick={handleClick}>
      <UsersIcon />
      {t("agentMembership:members")}
    </Button>
  )
}
