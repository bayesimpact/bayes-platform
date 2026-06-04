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
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentConversationAgentSessionsData } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.selectors"
import type { ExtractionAgentSessionSummary } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.models"
import { selectCurrentExtractionAgentSessionsData } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.selectors"
import { selectCurrentFormAgentSessionsData } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.selectors"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { AgentSessionItem } from "@/common/features/agents/components/AgentSessionItem"
import { ExtractionSessionCreatorWithLastSession } from "@/common/features/agents/components/ExtractionAgentSessionCreator"
import { ExtractionSessionItem } from "@/common/features/agents/components/ExtractionAgentSessionItem"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { ErrorRoute } from "@/common/routes/ErrorRoute"
import { useAppSelector } from "@/common/store/hooks"
import { AgentActions } from "./AgentActions"
import { AgentEditor } from "./AgentEditor"
import { AgentSessionListHeader } from "./AgentSessionListHeader"

export function ConversationAgentSessionList() {
  const agent = useValue(selectCurrentAgentData)
  const agentSessions = useValue(selectCurrentConversationAgentSessionsData)
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

      <Grid cols={3}>
        <GridContent>
          {agentSessions.map((session) => (
            <AgentSessionItem
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

export function FormAgentSessionList() {
  const agent = useValue(selectCurrentAgentData)
  const agentSessions = useValue(selectCurrentFormAgentSessionsData)
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

      <Grid cols={3}>
        <GridContent>
          {agentSessions.map((session) => (
            <AgentSessionItem
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

export function ExtractionAgentSessionList() {
  const agent = useValue(selectCurrentAgentData)
  const agentSessions = useValue(selectCurrentExtractionAgentSessionsData)
  const outlet = useOutlet()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const projectRoute = useGetProjectRoute()

  const organizationId = useAppSelector(selectCurrentOrganizationId)
  const projectId = useAppSelector(selectCurrentProjectId)

  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agent.id })

  const handleBack = () => navigate(projectRoute)

  if (!organizationId || !projectId)
    return <ErrorRoute error={"Missing organization or project ID"} />

  if (outlet) return outlet
  return (
    <Grid cols={0}>
      <GridHeader
        onBack={handleBack}
        title={t("extractionAgentSession:playground.title")}
        description={t("extractionAgentSession:playground.description")}
        action={<AgentActions agent={agent} organizationId={organizationId} />}
      />

      <GridCard
        className={cn("bg-muted/35 border-r-0 col-span-full", canManageAgent && "border-b")}
      >
        <GridCard.Body>
          <GridCard.Title>{t("extractionAgentSession:create.title")}</GridCard.Title>
          <GridCard.Description>
            {t("extractionAgentSession:create.description")}
          </GridCard.Description>
          <div className="flex items-center gap-2">
            <History agentSessions={agentSessions} />
            <ExtractionSessionCreatorWithLastSession buttonText={t("actions:test")} />
          </div>
        </GridCard.Body>
      </GridCard>

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
          <Grid cols={0}>
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
