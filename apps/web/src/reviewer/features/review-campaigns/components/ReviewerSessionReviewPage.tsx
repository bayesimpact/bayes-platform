"use client"

import type {
  SubmitReviewerSessionReviewRequestDto,
  UpdateReviewerSessionReviewRequestDto,
} from "@caseai-connect/api-contracts"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { ReviewerRoutes } from "@/reviewer/routes/helpers"
import { selectReviewerSessionDetail } from "../reviewer.selectors"
import { getReviewerSession, submitReviewerReview, updateReviewerReview } from "../reviewer.thunks"
import { ReviewerSessionReview } from "./ReviewerSessionReview"

type Params = {
  organizationId: string
  projectId: string
  reviewCampaignId: string
  sessionId: string
}

export function ReviewerSessionReviewPage() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const params = useParams<Params>() as Params
  const detailState = useAppSelector(selectReviewerSessionDetail(params.sessionId))

  if (!ADS.isFulfilled(detailState)) return null

  const handleSubmit = async (payload: SubmitReviewerSessionReviewRequestDto) => {
    await dispatch(
      submitReviewerReview({
        organizationId: params.organizationId,
        projectId: params.projectId,
        reviewCampaignId: params.reviewCampaignId,
        sessionId: params.sessionId,
        fields: payload,
      }),
    ).unwrap()
    dispatch(
      getReviewerSession({
        organizationId: params.organizationId,
        projectId: params.projectId,
        reviewCampaignId: params.reviewCampaignId,
        sessionId: params.sessionId,
      }),
    )
  }

  const handleUpdate = async (payload: UpdateReviewerSessionReviewRequestDto) => {
    if (detailState.value.blind) return
    await dispatch(
      updateReviewerReview({
        organizationId: params.organizationId,
        projectId: params.projectId,
        reviewCampaignId: params.reviewCampaignId,
        sessionId: params.sessionId,
        reviewId: detailState.value.myReview.id,
        fields: payload,
      }),
    ).unwrap()
    dispatch(
      getReviewerSession({
        organizationId: params.organizationId,
        projectId: params.projectId,
        reviewCampaignId: params.reviewCampaignId,
        sessionId: params.sessionId,
      }),
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <button
        type="button"
        className="text-muted-foreground w-fit text-sm hover:underline"
        onClick={() => navigate(ReviewerRoutes.campaign.build(params))}
      >
        {t("reviewerCampaigns:sessionPage.back")}
      </button>

      <ReviewerSessionReview
        session={detailState.value}
        onSubmitReview={handleSubmit}
        onUpdateReview={handleUpdate}
      />
    </div>
  )
}
