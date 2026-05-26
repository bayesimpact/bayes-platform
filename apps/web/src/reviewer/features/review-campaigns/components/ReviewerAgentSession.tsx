import type {
  SubmitReviewerSessionReviewRequestDto,
  UpdateReviewerSessionReviewRequestDto,
} from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { UserIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { selectCurrentReviewerSessionId } from "@/common/features/review-campaigns/current-reviewer-session-id/current-reviewer-session-id.selectors"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { ReviewerRoutes } from "../../../routes/helpers"
import { selectReviewerSessionDetail } from "../reviewer.selectors"
import { submitReviewerReview, updateReviewerReview } from "../reviewer.thunks"
import { ReviewerSessionReview } from "./ReviewerSessionReview"

export function ReviewerAgentSession() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const reviewCampaignId = useCurrentId(selectCurrentReviewCampaignId)
  const sessionId = useCurrentId(selectCurrentReviewerSessionId)
  const detail = useValue(selectReviewerSessionDetail)

  const agent = detail.agent

  const handleBack = () => {
    const scope = { organizationId, projectId, reviewCampaignId, sessionId }
    navigate(ReviewerRoutes.campaign.build(scope))
  }
  const handleSubmit = (fields: SubmitReviewerSessionReviewRequestDto) => {
    dispatch(submitReviewerReview({ fields }))
    handleBack()
  }

  const handleUpdate = (fields: UpdateReviewerSessionReviewRequestDto) => {
    if (detail.blind) return
    dispatch(updateReviewerReview({ reviewId: detail.myReview.id, fields }))
    handleBack()
  }

  return (
    <>
      <GridHeader
        title={agent.name}
        description={
          <>
            <UserIcon className="size-4" />{" "}
            {t("reviewerCampaigns:metadata.tester", { id: shortenId(detail.testerUserId) })}
          </>
        }
        onBack={handleBack}
        action={<Badge variant="outline">{agent.type}</Badge>}
      />

      <ReviewerSessionReview
        session={detail}
        onSubmitReview={handleSubmit}
        onUpdateReview={handleUpdate}
      />
    </>
  )
}
const shortenId = (id: string) => `${id.slice(0, 8)}…`
