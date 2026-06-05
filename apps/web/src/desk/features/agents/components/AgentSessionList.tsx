import { cn } from "@caseai-connect/ui/utils"
import { Loader2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate, useOutlet } from "react-router-dom"
import { Grid, GridCard, GridContent, GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentConversationAgentSessionsData } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.selectors"
import {
  selectCurrentExtractionAgentSessionsData,
  selectIsProcessingExecution,
} from "@/common/features/agents/agent-sessions/extraction/extraction-agent-sessions.selectors"
import { selectCurrentFormAgentSessionsData } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.selectors"
import { selectCurrentAgentData } from "@/common/features/agents/agents.selectors"
import { getAgentIcon } from "@/common/features/agents/components/AgentIcon"
import { AgentSessionItem } from "@/common/features/agents/components/AgentSessionItem"
import { ExtractionSessionCreator } from "@/common/features/agents/components/ExtractionAgentSessionCreator"
import { ExtractionSessionItem } from "@/common/features/agents/components/ExtractionAgentSessionItem"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { ErrorRoute } from "@/common/routes/ErrorRoute"
import { useAppSelector } from "@/common/store/hooks"
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
        organizationId={organizationId}
        projectId={projectId}
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

  const organizationId = useAppSelector(selectCurrentOrganizationId)
  const projectId = useAppSelector(selectCurrentProjectId)

  if (!organizationId || !projectId)
    return <ErrorRoute error={"Missing organization or project ID"} />

  if (outlet) return outlet
  return (
    <>
      <AgentSessionListHeader
        organizationId={organizationId}
        projectId={projectId}
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
  const isProcessingExecution = useAppSelector(selectIsProcessingExecution)
  const organizationId = useAppSelector(selectCurrentOrganizationId)
  const projectId = useAppSelector(selectCurrentProjectId)

  const handleBack = () => navigate(projectRoute)

  const Icon = getAgentIcon(agent.type)

  if (!organizationId || !projectId)
    return <ErrorRoute error={"Missing organization or project ID"} />

  if (outlet) return outlet
  return (
    <Grid cols={0}>
      <GridHeader
        onBack={handleBack}
        title={agent.name}
        description={
          isProcessingExecution ? (
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
        <GridCard
          className={cn(
            "bg-muted/35 border-r-0 col-span-full",
            agentSessions.length > 0 && "border-b",
          )}
        >
          <GridCard.Body>
            <GridCard.Title>{t("extractionAgentSession:create.title")}</GridCard.Title>
            <GridCard.Description>
              {t("extractionAgentSession:create.description")}
            </GridCard.Description>
            <ExtractionSessionCreator
              buttonText={t("actions:run")}
              onSuccess={() => {}}
              disabled={isProcessingExecution}
            />
          </GridCard.Body>
        </GridCard>

        {agentSessions.map((session, index) => (
          <ExtractionSessionItem
            className={cn(index === agentSessions.length - 1 ? "" : "border-b")}
            key={session.id}
            agentSession={session}
          />
        ))}
      </div>
    </Grid>
  )
}
