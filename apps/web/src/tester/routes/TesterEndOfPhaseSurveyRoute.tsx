import type {
  SubmitTesterCampaignSurveyRequestDto,
  UpdateTesterCampaignSurveyRequestDto,
} from "@caseai-connect/api-contracts"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { TesterRoutes } from "@/tester/routes/helpers"
import { EndOfPhaseSurveyForm } from "../features/review-campaigns/components/EndOfPhaseSurveyForm"
import {
  selectCampaignSurvey,
  selectTesterContext,
} from "../features/review-campaigns/tester.selectors"
import { submitTesterSurvey, updateTesterSurvey } from "../features/review-campaigns/tester.thunks"

export function TesterEndOfPhaseSurveyRoute() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const reviewCampaignId = useCurrentId(selectCurrentReviewCampaignId)
  const context = useValue(selectTesterContext)
  const existingSurvey = useValue(selectCampaignSurvey)

  const handleBack = () => {
    navigate(TesterRoutes.campaign.build({ organizationId, projectId, reviewCampaignId }))
  }

  const handleSubmit = async (
    fields: SubmitTesterCampaignSurveyRequestDto | UpdateTesterCampaignSurveyRequestDto,
  ) => {
    if (existingSurvey) {
      dispatch(updateTesterSurvey({ fields }))
    } else {
      dispatch(
        submitTesterSurvey({
          // FIXME: no as
          fields: fields as SubmitTesterCampaignSurveyRequestDto,
        }),
      )
    }

    handleBack()
  }

  return (
    <EndOfPhaseSurveyForm
      questions={context.testerEndOfPhaseQuestions}
      defaults={
        existingSurvey
          ? {
              overallRating: existingSurvey.overallRating,
              comment: existingSurvey.comment,
              answers: existingSurvey.answers,
            }
          : undefined
      }
      onSubmit={handleSubmit}
      onCancel={handleBack}
      submitLabel={
        existingSurvey
          ? t("testerCampaigns:endOfPhaseForm.saveChanges")
          : t("testerCampaigns:endOfPhaseForm.submit")
      }
    />
  )
}
