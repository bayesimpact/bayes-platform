import { Button } from "@caseai-connect/ui/shad/button"
import { ExternalLinkIcon, PenLineIcon, UsersIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useFeatureFlags } from "@/common/hooks/use-feature-flags"
import { useValue } from "@/common/hooks/use-value"
import { DeskRoutes } from "@/desk/routes/helpers"
import { EvalRoutes } from "@/eval/routes/helpers"
import { AgentDeletorWithTrigger } from "@/studio/features/agents/components/AgentDeletor"
import { StudioRoutes } from "@/studio/routes/helpers"

export function AgentActions({ organizationId, agent }: { organizationId: string; agent: Agent }) {
  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agent.id })
  return (
    <>
      <NavEvaluation organizationId={organizationId} projectId={agent.projectId} />

      <NavApp organizationId={organizationId} projectId={agent.projectId} agentId={agent.id} />

      {canManageAgent && (
        <>
          <NavAgentMemberships
            organizationId={organizationId}
            projectId={agent.projectId}
            agentId={agent.id}
          />

          {agent.type !== "extraction" && (
            <NavAgentEdit
              organizationId={organizationId}
              projectId={agent.projectId}
              agentId={agent.id}
            />
          )}

          <AgentDeletorWithTrigger organizationId={organizationId} agent={agent} />
        </>
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
        {t("actions:goToApp")}
      </a>
    </Button>
  )
}

function NavEvaluation({
  organizationId,
  projectId,
}: {
  organizationId: string
  projectId: string
}) {
  const { t } = useTranslation()
  const project = useValue(selectCurrentProjectData)
  const { hasFeature } = useFeatureFlags(project)
  if (!hasFeature("evaluation")) return null
  const extractionPath = EvalRoutes.extraction.build({ organizationId, projectId })
  return (
    <Button variant="secondary" asChild>
      <a target="_blank" rel="noopener noreferrer" href={extractionPath}>
        <ExternalLinkIcon />
        {t("actions:goToEval")}
      </a>
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
