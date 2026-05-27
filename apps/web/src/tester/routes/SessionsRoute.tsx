import type { SubmitTesterSessionFeedbackRequestDto } from "@caseai-connect/api-contracts"
import { useState } from "react"
import { useNavigate, useOutlet } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { TesterRoutes } from "@/tester/routes/helpers"
import { CampaignLanding } from "../features/review-campaigns/components/CampaignLanding"
import { FinishParticipatingDialog } from "../features/review-campaigns/components/FinishParticipatingDialog"
import { TesterFeedbackModal } from "../features/review-campaigns/components/TesterFeedbackModal"
import {
  selectCampaignSessions,
  selectCampaignSurvey,
  selectTesterContext,
} from "../features/review-campaigns/tester.selectors"
import {
  deleteTesterSession,
  submitTesterFeedback,
} from "../features/review-campaigns/tester.thunks"

export function SessionsRoute() {
  const sessions = useAppSelector(selectCampaignSessions)
  const existingSurvey = useAppSelector(selectCampaignSurvey)
  return (
    <AsyncRoute data={[sessions, existingSurvey]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const outlet = useOutlet()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const reviewCampaignId = useCurrentId(selectCurrentReviewCampaignId)

  const context = useValue(selectTesterContext)
  const sessions = useValue(selectCampaignSessions)
  const existingSurvey = useValue(selectCampaignSurvey)

  const [feedbackSessionId, setFeedbackSessionId] = useState<string | null>(null)
  const [finishOpen, setFinishOpen] = useState(false)

  const handleSubmitFeedback = async (payload: SubmitTesterSessionFeedbackRequestDto) => {
    if (!feedbackSessionId) return
    dispatch(
      submitTesterFeedback({
        sessionId: feedbackSessionId,
        fields: payload,
      }),
    )
    setFeedbackSessionId(null)
  }

  const handleDeleteSession = (sessionId: string) => {
    dispatch(deleteTesterSession({ sessionId }))
  }

  const handleFinish = () => {
    setFinishOpen(false)
    navigate(
      TesterRoutes.survey.build({
        organizationId,
        projectId,
        reviewCampaignId,
      }),
    )
  }

  const handleResumeSession = (sessionId: string) => {
    navigate(
      TesterRoutes.session.build({
        organizationId,
        projectId,
        reviewCampaignId,
        agentId: context.agent.id,
        agentSessionId: sessionId,
      }),
    )
  }

  const handleEditSurvey = () => {
    navigate(
      TesterRoutes.survey.build({
        organizationId,
        projectId,
        reviewCampaignId,
      }),
    )
  }

  if (outlet) return outlet
  return (
    <>
      <CampaignLanding
        context={context}
        sessions={sessions}
        participationFinished={!!existingSurvey}
        onOpenFeedback={(sessionId) => setFeedbackSessionId(sessionId)}
        onDeleteSession={handleDeleteSession}
        onResumeSession={handleResumeSession}
        onFinishParticipating={() => setFinishOpen(true)}
        onEditSurvey={handleEditSurvey}
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
