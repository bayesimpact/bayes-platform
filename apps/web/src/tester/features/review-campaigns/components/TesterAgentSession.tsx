import type { SubmitTesterSessionFeedbackRequestDto } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { CheckCircle2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import type { ConversationAgentSession } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.models"
import { FormResult } from "@/common/features/agents/agent-sessions/form/components/FormResult"
import type { FormAgentSession } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"
import { selectCurrentMessagesData } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.selectors"
import { AgentSessionMessages } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/AgentSessionMessages"
import type { Agent } from "@/common/features/agents/agents.models"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { TesterRoutes } from "@/tester/routes/helpers"
import { selectCurrentAgentSession, selectTesterContext } from "../tester.selectors"
import { listMyTesterSessions, submitTesterFeedback } from "../tester.thunks"
import { TesterFeedbackModal } from "./TesterFeedbackModal"

export function TesterAgentSession() {
  const context = useValue(selectTesterContext)
  const messages = useValue(selectCurrentMessagesData)
  const agentSession = useValue(selectCurrentAgentSession)

  return (
    <TesterAgentSessionContent
      agent={context.agent as Agent}
      agentSession={agentSession}
      messages={messages}
      campaignName={context.name}
      perSessionQuestions={context.testerPerSessionQuestions}
      ended={agentSession.feedbackStatus !== "pending"}
    />
  )
}

type TesterAgentSessionContentProps = {
  agent: Agent
  agentSession: ConversationAgentSession | FormAgentSession
  messages: React.ComponentProps<typeof AgentSessionMessages>["messages"]
  campaignName: string
  perSessionQuestions: React.ComponentProps<typeof TesterFeedbackModal>["questions"]
  ended: boolean
}

export function TesterAgentSessionContent({
  agent,
  agentSession,
  messages,
  campaignName,
  perSessionQuestions,
  ended,
}: TesterAgentSessionContentProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const reviewCampaignId = useCurrentId(selectCurrentReviewCampaignId)

  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const handleBack = () => {
    const path = TesterRoutes.campaign.build({ organizationId, projectId, reviewCampaignId })
    navigate(path)
    setFeedbackOpen(false)
  }

  const handleSubmitFeedback = (payload: SubmitTesterSessionFeedbackRequestDto) => {
    dispatch(
      submitTesterFeedback({
        sessionId: agentSession.id,
        fields: payload,
      }),
    )
    handleBack()
  }

  const handleFillFormToolEvent = () => {
    dispatch(
      listMyTesterSessions({
        organizationId,
        projectId,
        reviewCampaignId,
      }),
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <GridHeader
        onBack={handleBack}
        title={campaignName}
        description={
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">{t("testerCampaigns:agentSession.badge")}</Badge>
            <span>{agent.name}</span>
          </div>
        }
        action={
          !ended && (
            <Button onClick={() => setFeedbackOpen(true)}>
              <CheckCircle2Icon /> {t("testerCampaigns:agentSession.endSession")}
            </Button>
          )
        }
      />

      <div className="flex-1 overflow-hidden">
        <AgentSessionMessages
          session={agentSession}
          messages={messages}
          rightSlot={
            agent.type === "form" ? (
              <FormResult agent={agent} agentSession={agentSession} />
            ) : undefined
          }
          onFillFormToolEvent={handleFillFormToolEvent}
        />
      </div>

      <TesterFeedbackModal
        open={feedbackOpen}
        questions={perSessionQuestions}
        onSubmit={handleSubmitFeedback}
        onAbandon={handleBack}
      />
    </div>
  )
}
