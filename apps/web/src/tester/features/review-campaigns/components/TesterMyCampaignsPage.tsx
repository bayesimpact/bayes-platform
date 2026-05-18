import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { TesterRoutes } from "@/tester/routes/helpers"
import { selectMyReviewCampaigns } from "../tester.selectors"
import { reviewCampaignsTesterActions } from "../tester.slice"
import { MyCampaignsList } from "./MyCampaignsList"

export function TesterMyCampaignsPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const myCampaigns = useAppSelector(selectMyReviewCampaigns)

  useEffect(() => {
    dispatch(reviewCampaignsTesterActions.mount())
    return () => {
      dispatch(reviewCampaignsTesterActions.unmount())
    }
  }, [dispatch])

  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("testerCampaigns:myCampaigns.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("testerCampaigns:myCampaigns.subtitle")}</p>
      </header>

      {ADS.isLoading(myCampaigns) && (
        <p className="text-muted-foreground text-sm">{t("testerCampaigns:common.loading")}</p>
      )}
      {ADS.isError(myCampaigns) && <p className="text-destructive text-sm">{myCampaigns.error}</p>}
      {ADS.isFulfilled(myCampaigns) && (
        <MyCampaignsList
          campaigns={myCampaigns.value}
          onOpen={(campaign) =>
            navigate(
              TesterRoutes.campaign.build({
                organizationId: campaign.organizationId,
                projectId: campaign.projectId,
                reviewCampaignId: campaign.id,
              }),
            )
          }
        />
      )}
    </div>
  )
}
