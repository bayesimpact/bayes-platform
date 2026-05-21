import type {
  SubmitTesterCampaignSurveyRequestDto,
  UpdateTesterCampaignSurveyRequestDto,
} from "@caseai-connect/api-contracts"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { TesterRoutes } from "@/tester/routes/helpers"
import { selectMySurveyForCampaign, selectTesterContext } from "../tester.selectors"
import { submitTesterSurvey, updateTesterSurvey } from "../tester.thunks"
import { EndOfPhaseSurveyForm } from "./EndOfPhaseSurveyForm"

type Params = {
  organizationId: string
  projectId: string
  reviewCampaignId: string
}

export function TesterEndOfPhaseSurveyPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const params = useParams<Params>() as Params
  const contextState = useAppSelector(selectTesterContext)
  const existingSurvey = useAppSelector(selectMySurveyForCampaign(params.reviewCampaignId))

  if (!ADS.isFulfilled(contextState)) return null

  const backToLanding = () => {
    navigate(
      TesterRoutes.campaign.build({
        organizationId: params.organizationId,
        projectId: params.projectId,
        reviewCampaignId: params.reviewCampaignId,
      }),
    )
  }

  const handleSubmit = async (
    payload: SubmitTesterCampaignSurveyRequestDto | UpdateTesterCampaignSurveyRequestDto,
  ) => {
    if (existingSurvey) {
      await dispatch(
        updateTesterSurvey({
          organizationId: params.organizationId,
          projectId: params.projectId,
          reviewCampaignId: params.reviewCampaignId,
          fields: payload,
        }),
      ).unwrap()
    } else {
      await dispatch(
        submitTesterSurvey({
          organizationId: params.organizationId,
          projectId: params.projectId,
          reviewCampaignId: params.reviewCampaignId,
          fields: payload as SubmitTesterCampaignSurveyRequestDto,
        }),
      ).unwrap()
    }
    backToLanding()
  }

  return (
    <EndOfPhaseSurveyForm
      questions={contextState.value.testerEndOfPhaseQuestions}
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
      onCancel={backToLanding}
      submitLabel={
        existingSurvey
          ? t("testerCampaigns:endOfPhaseForm.saveChanges")
          : t("testerCampaigns:endOfPhaseForm.submit")
      }
    />
  )
}
