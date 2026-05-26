import type { ReviewCampaignTesterContextDto } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@caseai-connect/ui/shad/item"
import { BarChartIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { selectCurrentReviewCampaignId } from "@/common/features/review-campaigns/current-review-campaign-id/current-review-campaign-id.selectors"
import { useCurrentId, useValue } from "@/common/hooks/use-value"
import { ReviewerRoutes } from "@/reviewer/routes/helpers"
import { selectTesterContext } from "@/tester/features/review-campaigns/tester.selectors"
import { selectReviewerSessions } from "../reviewer.selectors"
import { ReviewerSessionsTable } from "./ReviewerSessionsTable"

export function CampaignSessionList() {
  const context = useValue(selectTesterContext)
  const sessions = useValue(selectReviewerSessions)

  const { t } = useTranslation()
  const navigate = useNavigate()

  const pendingCount = sessions.filter(
    (session) => !session.callerHasReviewed && !session.callerIsSessionOwner,
  ).length

  const agentTypeLabel: Record<ReviewCampaignTesterContextDto["agent"]["type"], string> = {
    conversation: t("reviewerCampaigns:landing.agentType.conversation"),
    extraction: t("reviewerCampaigns:landing.agentType.extraction"),
    form: t("reviewerCampaigns:landing.agentType.form"),
  }

  return (
    <>
      <GridHeader
        onBack={() => navigate(ReviewerRoutes.home.path)}
        title={context.name}
        description={context.description}
        action={<ReportButton />}
      />

      <div className="p-6 flex flex-col gap-6">
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>{context.agent.name}</ItemTitle>
            <ItemDescription>
              <Badge variant="outline">{agentTypeLabel[context.agent.type]}</Badge>
            </ItemDescription>

            {context.agent.greetingMessage && (
              <p className="text-muted-foreground text-sm italic">
                "{context.agent.greetingMessage}"
              </p>
            )}
          </ItemContent>
        </Item>

        <section className="flex flex-col gap-3">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {t("reviewerCampaigns:landing.sessionsHeading")}
            </h2>
            <span className="text-muted-foreground text-sm">
              {t("reviewerCampaigns:landing.sessionsCount", { count: sessions.length })}
              {pendingCount > 0
                ? t("reviewerCampaigns:landing.pendingSuffix", { count: pendingCount })
                : ""}
            </span>
          </header>
          <ReviewerSessionsTable sessions={sessions} />
        </section>
      </div>
    </>
  )
}

function ReportButton() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const reviewCampaignId = useCurrentId(selectCurrentReviewCampaignId)

  const handleClick = () => {
    navigate(
      ReviewerRoutes.report.build({
        organizationId,
        projectId,
        reviewCampaignId,
      }),
    )
  }
  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <BarChartIcon /> {t("reviewerCampaigns:landing.campaignReport")}
    </Button>
  )
}
