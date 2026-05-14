import { Button } from "@caseai-connect/ui/shad/button"
import { ExternalLinkIcon, UsersIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import type { Agent } from "@/common/features/agents/agents.models"
import { useAbility } from "@/common/hooks/use-ability"
import { useGetPath } from "@/common/hooks/use-build-path"
import { DeskRouteNames } from "@/desk/routes/helpers"
import { AgentDeletorWithTrigger } from "@/studio/features/agents/components/AgentDeletor"
import { buildAgentMembershipsPath } from "@/studio/routes/helpers"
import { AgentEditorWithTrigger } from "./AgentEditor"

export function AgentActions({ organizationId, agent }: { organizationId: string; agent: Agent }) {
  const { t } = useTranslation()
  const { getPath } = useGetPath()
  const path = getPath("agent", { forceInterface: DeskRouteNames.HOME })
  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agent.id })
  return (
    <>
      <Button variant="secondary" asChild>
        <a target="_blank" rel="noopener noreferrer" href={path}>
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

          {agent.type !== "extraction" && <AgentEditorWithTrigger agent={agent} />}

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
  const path = buildAgentMembershipsPath({ organizationId, projectId, agentId })
  const handleClick = () => navigate(path)
  return (
    <Button variant="outline" size="lg" onClick={handleClick}>
      <UsersIcon />
      {t("agentMembership:members")}
    </Button>
  )
}
