import { useTranslation } from "react-i18next"
import { useOutlet } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import { ReviewerCampaignsList } from "../features/review-campaigns/components/ReviewerCampaignsList"
import { selectReviewerCampaigns } from "../features/review-campaigns/reviewer.selectors"
import { reviewCampaignsReviewerActions } from "../features/review-campaigns/reviewer.slice"

export function CampaignsRoute() {
  const campaigns = useAppSelector(selectReviewerCampaigns)
  useMount({ actions: reviewCampaignsReviewerActions })

  return (
    <AsyncRoute data={[campaigns]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const outlet = useOutlet()
  const { t } = useTranslation()
  const campaigns = useValue(selectReviewerCampaigns)
  if (outlet) return outlet
  return (
    <>
      <GridHeader
        title={t("reviewerCampaigns:myCampaigns.title")}
        description={t("reviewerCampaigns:myCampaigns.subtitle")}
      />
      <ReviewerCampaignsList campaigns={campaigns} />
    </>
  )
}
