import type { SubmitTesterSessionFeedbackRequestDto } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { ArrowLeftIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import { FormResult } from "@/common/features/agents/agent-sessions/form/components/FormResult"
import type { FormAgentSession } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"
import type { AgentSessionMessage } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import { selectCurrentMessagesData } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.selectors"
import { AgentSessionMessages } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/AgentSessionMessages"
import type { Agent } from "@/common/features/agents/agents.models"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { TesterRoutes } from "@/tester/routes/helpers"
import { selectTesterContext } from "../tester.selectors"
import { submitTesterFeedback } from "../tester.thunks"
import { TesterFeedbackModal } from "./TesterFeedbackModal"

type Params = {
  organizationId: string
  projectId: string
  reviewCampaignId: string
  agentId: string
  agentSessionId: string
}

export function TesterAgentSessionPage() {
  const params = useParams<Params>() as Params
  const contextState = useAppSelector(selectTesterContext)
  const messagesData = useAppSelector(selectCurrentMessagesData)

  const syntheticSession = useMemo<ConversationAgentSession | FormAgentSession>(() => {
    const now = Date.now()
    return {
      id: params.agentSessionId,
      agentId: params.agentId,
      type: "live",
      createdAt: now,
      updatedAt: now,
    }
  }, [params.agentId, params.agentSessionId])

  if (!ADS.isFulfilled(contextState)) return null

  const messages: AgentSessionMessage[] = ADS.isFulfilled(messagesData) ? messagesData.value : []

  return (
    <TesterAgentSessionContent
      organizationId={params.organizationId}
      projectId={params.projectId}
      agent={contextState.value.agent as Agent}
      agentSession={syntheticSession}
      messages={messages}
      campaignName={contextState.value.name}
      perSessionQuestions={contextState.value.testerPerSessionQuestions}
      backPath={TesterRoutes.campaign.build(params)}
    />
  )
}

type TesterAgentSessionContentProps = {
  organizationId: string
  projectId: string
  agent: Agent
  agentSession: ConversationAgentSession | FormAgentSession
  messages: React.ComponentProps<typeof AgentSessionMessages>["messages"]
  campaignName: string
  perSessionQuestions: React.ComponentProps<typeof TesterFeedbackModal>["questions"]
  backPath: string
}

export function TesterAgentSessionContent({
  organizationId,
  projectId,
  agent,
  agentSession,
  messages,
  campaignName,
  perSessionQuestions,
  backPath,
}: TesterAgentSessionContentProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const handleSubmitFeedback = async (payload: SubmitTesterSessionFeedbackRequestDto) => {
    await dispatch(
      submitTesterFeedback({
        organizationId,
        projectId,
        sessionId: agentSession.id,
        fields: payload,
      }),
    ).unwrap()
    setFeedbackOpen(false)
    navigate(backPath)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
            <ArrowLeftIcon /> {t("testerCampaigns:agentSession.back")}
          </Button>
          <div className="hidden md:flex items-center gap-2 text-sm">
            <Badge variant="outline">{t("testerCampaigns:agentSession.badge")}</Badge>
            <span className="font-medium">{campaignName}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{agent.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(backPath)}>
            <XCircleIcon /> {t("testerCampaigns:agentSession.abandon")}
          </Button>
          <Button onClick={() => setFeedbackOpen(true)}>
            <CheckCircle2Icon /> {t("testerCampaigns:agentSession.endSession")}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <AgentSessionMessages
          session={agentSession}
          messages={messages}
          rightSlot={
            agent.type === "form" ? (
              <FormResult agent={agent} agentSession={agentSession} />
            ) : undefined
          }
        />
      </div>

      <TesterFeedbackModal
        open={feedbackOpen}
        questions={perSessionQuestions}
        onSubmit={handleSubmitFeedback}
        onAbandon={() => {
          setFeedbackOpen(false)
          navigate(backPath)
        }}
      />
    </div>
  )
}
