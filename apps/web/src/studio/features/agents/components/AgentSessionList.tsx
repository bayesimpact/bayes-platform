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
import { PlusCircleIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useOutlet } from "react-router-dom"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentConversationAgentSessionsData } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.selectors"
import type {
  ExtractionAgentSessionSummary,
  ExtractionAgentSessions,
} from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.models"
import { selectCurrentExtractionAgentSessionsData } from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.selectors"
import { selectCurrentFormAgentSessionsData } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.selectors"
import {
  selectCurrentAgentData,
  selectCurrentAgentId,
} from "@/common/features/agents/agents.selectors"
import { AgentSessionItem } from "@/common/features/agents/components/AgentSessionItem"
import {
  CsvExtractionSessionItem,
  ExtractionSessionItem,
} from "@/common/features/agents/components/ExtractionAgentSessionItem"
import type { AgentCsvExtractionRun } from "@/common/features/agents/csv-extraction-runs/agent-csv-extraction-runs.models"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useAbility } from "@/common/hooks/use-ability"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { StudioRoutes } from "@/studio/routes/helpers"
import { AgentActions } from "./AgentActions"
import { AgentEditor } from "./AgentEditor"
import { AgentSessionListHeader } from "./AgentSessionListHeader"

export function ConversationAgentSessionList() {
  const agent = useValue(selectCurrentAgentData)
  const agentSessions = useValue(selectCurrentConversationAgentSessionsData)
  const outlet = useOutlet()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)

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
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)

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
  const organizationId = useCurrentId(selectCurrentOrganizationId)

  const { abilities } = useAbility()
  const canManageAgent = abilities.canManageAgent({ agentId: agent.id })

  const handleBack = () => navigate(projectRoute)

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
            <ExtractionButton />
          </div>
        </GridCard.Body>
      </GridCard>

      {canManageAgent && <AgentEditor key={agent.id} agent={agent} className="bg-white p-6" />}
    </Grid>
  )
}

function ExtractionButton() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const agentId = useCurrentId(selectCurrentAgentId)

  const handleClick = () => {
    navigate(StudioRoutes.agentExtraction.build({ organizationId, projectId, agentId }))
  }
  return (
    <Button size="lg" className="text-base" onClick={handleClick}>
      {t("actions:run")}
      <PlusCircleIcon className="ml-2 size-5" />
    </Button>
  )
}

type MergedExtractionSession =
  | { kind: "session"; session: ExtractionAgentSessionSummary }
  | { kind: "csv"; session: AgentCsvExtractionRun }

export function mergeExtractionSessions({
  csvSessions,
  others,
}: ExtractionAgentSessions): MergedExtractionSession[] {
  const merged: MergedExtractionSession[] = [
    ...others.map((session) => ({ kind: "session" as const, session })),
    ...csvSessions.map((session) => ({ kind: "csv" as const, session })),
  ]
  return merged.sort((first, second) => second.session.updatedAt - first.session.updatedAt)
}

function History({ agentSessions }: { agentSessions: ExtractionAgentSessions }) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const items = mergeExtractionSessions(agentSessions)
  if (items.length === 0) return null
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
            {items.map((item, index) => {
              const itemClassName = cn("px-0", index !== items.length - 1 && "border-b")
              return item.kind === "csv" ? (
                <CsvExtractionSessionItem
                  className={itemClassName}
                  key={item.session.id}
                  agentSession={item.session}
                />
              ) : (
                <ExtractionSessionItem
                  className={itemClassName}
                  key={item.session.id}
                  agentSession={item.session}
                />
              )
            })}
          </Grid>
        </div>
      </DialogContent>
    </Dialog>
  )
}
