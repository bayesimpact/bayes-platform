import type { SubmitTesterSessionFeedbackRequestDto } from "@caseai-connect/api-contracts"
import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { TesterRoutes } from "@/tester/routes/helpers"
import {
  selectMyLocalSessions,
  selectMySurveyForCampaign,
  selectTesterContext,
} from "../tester.selectors"
import { deleteTesterSession, startTesterSession, submitTesterFeedback } from "../tester.thunks"
import { CampaignLanding } from "./CampaignLanding"
import { FinishParticipatingDialog } from "./FinishParticipatingDialog"
import { TesterFeedbackModal } from "./TesterFeedbackModal"

type Params = {
  organizationId: string
  projectId: string
  reviewCampaignId: string
}

export function TesterCampaignLandingPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const params = useParams<Params>() as Params

  const contextState = useAppSelector(selectTesterContext)
  const sessions = useAppSelector(selectMyLocalSessions(params.reviewCampaignId))
  const existingSurvey = useAppSelector(selectMySurveyForCampaign(params.reviewCampaignId))

  const [feedbackSessionId, setFeedbackSessionId] = useState<string | null>(null)
  const [finishOpen, setFinishOpen] = useState(false)

  if (!ADS.isFulfilled(contextState)) return null

  const context = contextState.value

  const handleStartSession = async () => {
    const result = await dispatch(
      startTesterSession({
        organizationId: params.organizationId,
        projectId: params.projectId,
        reviewCampaignId: params.reviewCampaignId,
        type: "live",
      }),
    ).unwrap()
    navigate(
      TesterRoutes.session.build({
        organizationId: params.organizationId,
        projectId: params.projectId,
        reviewCampaignId: params.reviewCampaignId,
        agentId: context.agent.id,
        agentSessionId: result.sessionId,
      }),
    )
  }

  const handleSubmitFeedback = async (payload: SubmitTesterSessionFeedbackRequestDto) => {
    if (!feedbackSessionId) return
    await dispatch(
      submitTesterFeedback({
        organizationId: params.organizationId,
        projectId: params.projectId,
        sessionId: feedbackSessionId,
        fields: payload,
      }),
    ).unwrap()
    setFeedbackSessionId(null)
  }

  const handleDeleteSession = async (sessionId: string) => {
    await dispatch(
      deleteTesterSession({
        organizationId: params.organizationId,
        projectId: params.projectId,
        sessionId,
        reviewCampaignId: params.reviewCampaignId,
      }),
    ).unwrap()
  }

  const handleFinish = () => {
    setFinishOpen(false)
    navigate(
      TesterRoutes.survey.build({
        organizationId: params.organizationId,
        projectId: params.projectId,
        reviewCampaignId: params.reviewCampaignId,
      }),
    )
  }

  return (
    <>
      <CampaignLanding
        context={context}
        sessions={sessions}
        participationFinished={!!existingSurvey}
        onStartSession={handleStartSession}
        onOpenFeedback={(sessionId) => setFeedbackSessionId(sessionId)}
        onDeleteSession={handleDeleteSession}
        onResumeSession={(sessionId) =>
          navigate(
            TesterRoutes.session.build({
              organizationId: params.organizationId,
              projectId: params.projectId,
              reviewCampaignId: params.reviewCampaignId,
              agentId: context.agent.id,
              agentSessionId: sessionId,
            }),
          )
        }
        onFinishParticipating={() => setFinishOpen(true)}
        onEditSurvey={() =>
          navigate(
            TesterRoutes.survey.build({
              organizationId: params.organizationId,
              projectId: params.projectId,
              reviewCampaignId: params.reviewCampaignId,
            }),
          )
        }
      />

      <TesterFeedbackModal
        open={feedbackSessionId !== null}
        questions={context.testerPerSessionQuestions}
        onSubmit={handleSubmitFeedback}
        onAbandon={() => setFeedbackSessionId(null)}
      />

      <FinishParticipatingDialog
        open={finishOpen}
        onConfirm={handleFinish}
        onCancel={() => setFinishOpen(false)}
      />
    </>
  )
}
