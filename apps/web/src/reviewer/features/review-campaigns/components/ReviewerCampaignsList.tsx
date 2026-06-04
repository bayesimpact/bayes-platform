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
import { Grid, GridCard, GridContent } from "@/common/components/grid/Grid"
import { ReviewerRoutes } from "@/reviewer/routes/helpers"
import type { ReviewerCampaign } from "../reviewer.models"

export function ReviewerCampaignsList({ campaigns }: { campaigns: ReviewerCampaign[] }) {
  if (campaigns.length === 0) return <EmptyCampaigns />
  return (
    <Grid cols={3}>
      <GridContent>
        {campaigns.map((campaign) => (
          <CampaignItem key={campaign.id} campaign={campaign} />
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

function CampaignItem({ campaign }: { campaign: ReviewerCampaign }) {
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
    <GridCard>
      <GridCard.Body>
        <GridCard.Title>{campaign.name}</GridCard.Title>
        <GridCard.Description>
          <div className="flex flex-col">
            <span>{campaign.description}</span>
            <span className="mt-2">{t("reviewerCampaigns:myCampaigns.card.description")}</span>
          </div>
        </GridCard.Description>
        <GridCard.GoButton onClick={handleClick} />
      </GridCard.Body>
    </GridCard>
  )
}
