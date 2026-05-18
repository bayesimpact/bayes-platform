import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { cn } from "@caseai-connect/ui/utils"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useOutlet } from "react-router-dom"
import { Grid, GridContent, GridHeader, GridItem } from "@/common/components/grid/Grid"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import type { ExtractionAgentSessionSummary } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.models"
import type { FormAgentSession } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"
import type { Agent } from "@/common/features/agents/agents.models"
import { AgentSessionItem } from "@/common/features/agents/components/AgentSessionItem"
import { ExtractionSessionCreatorWithLastSession } from "@/common/features/agents/components/ExtractionAgentSessionCreator"
import { ExtractionSessionItem } from "@/common/features/agents/components/ExtractionAgentSessionItem"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { ErrorRoute } from "@/common/routes/ErrorRoute"
import { useAppSelector } from "@/common/store/hooks"
import { AgentActions } from "./AgentActions"
import { AgentEditor } from "./AgentEditor"
import { AgentSessionListHeader } from "./AgentSessionListHeader"

export function ConversationAgentSessionList({
  agent,
  agentSessions,
}: {
  agent: Agent
  agentSessions: ConversationAgentSession[]
}) {
  const outlet = useOutlet()
  const organizationId = useAppSelector(selectCurrentOrganizationId)
  const projectId = useAppSelector(selectCurrentProjectId)

  if (!organizationId || !projectId)
    return <ErrorRoute error={"Missing organization or project ID"} />

  if (outlet) return outlet

  return (
    <>
      <AgentSessionListHeader
        agent={agent}
        withBorderBottom={agentSessions.length > 0}
        backTo={outlet ? "agent" : "project"}
        organizationId={organizationId}
        projectId={projectId}
      />

      <Grid cols={3} total={agentSessions.length}>
        <GridContent>
          {agentSessions.map((session, index) => (
            <AgentSessionItem
              index={index}
              key={session.id}
              organizationId={organizationId}
              projectId={projectId}
              agentSession={session}
              agentId={agent.id}
              agentType={agent.type}
            />
          ))}
        </GridContent>
      </Grid>
    </>
  )
}

export function FormAgentSessionList({
  agent,
  agentSessions,
}: {
  agent: Agent
  agentSessions: FormAgentSession[]
}) {
  const outlet = useOutlet()
  const organizationId = useAppSelector(selectCurrentOrganizationId)
  const projectId = useAppSelector(selectCurrentProjectId)

  if (!organizationId || !projectId)
    return <ErrorRoute error={"Missing organization or project ID"} />

  if (outlet) return outlet
  return (
    <>
      <AgentSessionListHeader
        agent={agent}
        withBorderBottom={agentSessions.length > 0}
        backTo={outlet ? "agent" : "project"}
        organizationId={organizationId}
        projectId={projectId}
      />

      <Grid cols={3} total={agentSessions.length}>
        <GridContent>
          {agentSessions.map((session, index) => (
            <AgentSessionItem
              index={index}
              key={session.id}
              organizationId={organizationId}
              projectId={projectId}
              agentSession={session}
              agentId={agent.id}
              agentType={agent.type}
            />
          ))}
        </GridContent>
      </Grid>
    </>
  )
}

export function ExtractionAgentSessionList({
  agent,
  agentSessions,
}: {
  agent: Agent
  agentSessions: ExtractionAgentSessionSummary[]
}) {
  const outlet = useOutlet()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const getProjectRoute = useGetProjectRoute()

  const organizationId = useAppSelector(selectCurrentOrganizationId)
  const projectId = useAppSelector(selectCurrentProjectId)

  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agent.id })

  const handleBack = () => navigate(getProjectRoute())

  if (!organizationId || !projectId)
    return <ErrorRoute error={"Missing organization or project ID"} />

  if (outlet) return outlet
  return (
    <Grid cols={0} total={0}>
      <GridHeader
        onBack={handleBack}
        title={t("extractionAgentSession:playground.title")}
        description={t("extractionAgentSession:playground.description")}
        action={<AgentActions agent={agent} organizationId={organizationId} />}
      />

      <GridItem
        className={cn("bg-muted/35 border-r-0 col-span-full", canManageAgent && "border-b")}
        title={t("extractionAgentSession:create.title")}
        description={t("extractionAgentSession:create.description")}
        action={
          <div className="flex items-center gap-2">
            <History agentSessions={agentSessions} />
            <ExtractionSessionCreatorWithLastSession buttonText={t("actions:test")} />
          </div>
        }
      />

      {canManageAgent && <AgentEditor key={agent.id} agent={agent} className="bg-white p-6" />}
    </Grid>
  )
}

function History({ agentSessions }: { agentSessions: ExtractionAgentSessionSummary[] }) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  if (agentSessions.length === 0) return null
  return (
    <Dialog modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline">
          {t("extractionAgentSession:history.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="min-w-fit max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t("extractionAgentSession:history.title")}</DialogTitle>
          <DialogDescription>{t("extractionAgentSession:history.description")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 max-h-[60vh] overflow-y-auto">
          <Grid cols={0} total={0}>
            {agentSessions.map((session, index) => (
              <ExtractionSessionItem
                className={cn("px-0", index !== agentSessions.length - 1 && "border-b")}
                key={session.id}
                agentSession={session}
              />
            ))}
          </Grid>
        </div>
      </DialogContent>
    </Dialog>
  )
}
