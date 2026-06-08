import { Button } from "@caseai-connect/ui/shad/button"
import { cn } from "@caseai-connect/ui/utils"
import { Loader2Icon, PlusCircleIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate, useOutlet } from "react-router-dom"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentConversationAgentSessionsData } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.selectors"
import {
  selectCurrentExtractionAgentSessionsData,
  selectIsExtracting,
} from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.selectors"
import { selectCurrentFormAgentSessionsData } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.selectors"
import {
  selectCurrentAgentData,
  selectCurrentAgentId,
} from "@/common/features/agents/agents.selectors"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { AgentSessionItem } from "@/common/features/agents/components/AgentSessionItem"
import { ExtractionSessionItem } from "@/common/features/agents/components/ExtractionAgentSessionItem"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { useAppSelector } from "@/common/store/hooks"
import { DeskRoutes } from "@/desk/routes/helpers"
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
        withBorderBottom={agentSessions.length > 0}
        agent={agent}
        backTo={outlet ? "agent" : "project"}
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
        withBorderBottom={agentSessions.length > 0}
        agent={agent}
        backTo={outlet ? "agent" : "project"}
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
  const navigate = useNavigate()
  const projectRoute = useGetProjectRoute()
  const { t } = useTranslation()
  const isExtracting = useAppSelector(selectIsExtracting)

  const handleBack = () => navigate(projectRoute)

  const Icon = getAgentIcon(agent.type)

  const length = agentSessions.csvSessions.length + agentSessions.others.length

  if (outlet) return outlet
  return (
    <Grid cols={0}>
      <GridHeader
        onBack={handleBack}
        title={agent.name}
        description={
          isExtracting ? (
            <div className="flex items-center gap-1 text-primary">
              {t("status:loading")} <Loader2Icon className="animate-spin" />
            </div>
          ) : (
            <>
              <span className="capitalize-first">{t(`agent:create.typeDialog.${agent.type}`)}</span>
              <Icon />
            </>
          )
        }
      />
      <div className="flex flex-col">
        <GridCard className={cn("bg-muted/35 border-r-0 col-span-full", length > 0 && "border-b")}>
          <GridCard.Body>
            <GridCard.Title>{t("extractionAgentSession:create.title")}</GridCard.Title>
            <GridCard.Description>
              {t("extractionAgentSession:create.description")}
            </GridCard.Description>

            <ExtractionButton disabled={isExtracting} />
          </GridCard.Body>
        </GridCard>

        {agentSessions.others.map((session, index) => (
          <ExtractionSessionItem
            className={cn(index === agentSessions.others.length - 1 ? "" : "border-b")}
            key={session.id}
            agentSession={session}
          />
        ))}
      </div>
    </Grid>
  )
}

function ExtractionButton({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const agentId = useCurrentId(selectCurrentAgentId)

  const handleClick = () => {
    navigate(DeskRoutes.agentExtraction.build({ organizationId, projectId, agentId }))
  }
  return (
    <Button size="lg" className="text-base" disabled={disabled} onClick={handleClick}>
      {t("actions:run")}
      <PlusCircleIcon className="ml-2 size-5" />
    </Button>
  )
}
