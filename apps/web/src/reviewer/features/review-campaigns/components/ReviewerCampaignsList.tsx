import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import { ClipboardCheckIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Grid, GridContent, GridItem } from "@/common/components/grid/Grid"
import { ReviewerRoutes } from "@/reviewer/routes/helpers"
import type { ReviewerCampaign } from "../reviewer.models"

export function ReviewerCampaignsList({ campaigns }: { campaigns: ReviewerCampaign[] }) {
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

function EmptyCampaigns() {
  const { t } = useTranslation()
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ClipboardCheckIcon />
        </EmptyMedia>
        <EmptyTitle>{t("reviewerCampaigns:myCampaigns.empty.title")}</EmptyTitle>
        <EmptyDescription>{t("reviewerCampaigns:myCampaigns.empty.description")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function CampaignItem({ campaign, index }: { campaign: ReviewerCampaign; index: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const handleClick = () => {
    const path = ReviewerRoutes.campaign.build({
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
          <span className="mt-2">{t("reviewerCampaigns:myCampaigns.card.description")}</span>
        </div>
      }
      onClick={handleClick}
      index={index}
    />
  )
}
