import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import { MegaphoneIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridContent, GridItem } from "@/common/components/grid/Grid"
import { useValue } from "@/common/hooks/use-value"
import type { ReviewerCampaign } from "@/reviewer/features/review-campaigns/reviewer.models"
import { TesterRoutes } from "@/tester/routes/helpers"
import { selectMyReviewCampaigns } from "../tester.selectors"

export function CampaignList() {
  const campaigns = useValue(selectMyReviewCampaigns)

  if (campaigns.length === 0) return <EmptyCampaigns />
  return (
    <Grid cols={3} total={campaigns.length}>
      <GridContent>
        {campaigns.map((campaign, index) => (
          <CampaignItem key={campaign.id} campaign={campaign} index={index} />
        ))}
      </GridContent>
    </Grid>
  )
}

function CampaignItem({ campaign, index }: { campaign: ReviewerCampaign; index: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleClick = () => {
    const path = TesterRoutes.campaign.build({
      organizationId: campaign.organizationId,
      projectId: campaign.projectId,
      reviewCampaignId: campaign.id,
    })
    navigate(path)
  }

  return (
    <GridItem
      key={campaign.id}
      title={campaign.name}
      description={
        <div className="flex flex-col">
          <span>{campaign.description}</span>
          <span className="mt-2">{t("testerCampaigns:myCampaigns.card.invitedToEvaluate")}</span>
        </div>
      }
      onClick={handleClick}
      index={index}
    />
  )
}

function EmptyCampaigns() {
  const { t } = useTranslation()
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MegaphoneIcon />
        </EmptyMedia>
        <EmptyTitle>{t("testerCampaigns:myCampaigns.empty.title")}</EmptyTitle>
        <EmptyDescription>{t("testerCampaigns:myCampaigns.empty.description")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
