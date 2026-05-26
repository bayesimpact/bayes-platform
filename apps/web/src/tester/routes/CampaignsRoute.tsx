import { useTranslation } from "react-i18next"
import { useOutlet } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { useMount } from "@/common/hooks/use-mount"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppSelector } from "@/common/store/hooks"
import { CampaignList } from "../features/review-campaigns/components/CampaignList"
import { selectMyReviewCampaigns } from "../features/review-campaigns/tester.selectors"
import { reviewCampaignsTesterActions } from "../features/review-campaigns/tester.slice"

export function CampaignsRoute() {
  const campaigns = useAppSelector(selectMyReviewCampaigns)
  useMount({
    actions: {
      mount: reviewCampaignsTesterActions.campaignsMount,
      unmount: reviewCampaignsTesterActions.campaignsUnmount,
    },
  })

  return (
    <AsyncRoute data={[campaigns]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const { t } = useTranslation()
  const outlet = useOutlet()
  if (outlet) return outlet
  return (
    <>
      <GridHeader
        title={t("testerCampaigns:myCampaigns.title")}
        description={t("testerCampaigns:myCampaigns.subtitle")}
      />
      <CampaignList />
    </>
  )
}
