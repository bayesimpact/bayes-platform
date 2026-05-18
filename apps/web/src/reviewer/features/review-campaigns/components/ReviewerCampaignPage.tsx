import type { ReviewCampaignTesterContextDto } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@caseai-connect/ui/shad/item"
import { BarChartIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import { ReviewerRoutes } from "@/reviewer/routes/helpers"
import { selectTesterContext } from "@/tester/features/review-campaigns/tester.selectors"
import type { ReviewCampaignTesterContext, ReviewerSessionListItem } from "../reviewer.models"
import { selectReviewerSessions } from "../reviewer.selectors"
import { ReviewerSessionsTable } from "./ReviewerSessionsTable"

type Params = {
  organizationId: string
  projectId: string
  reviewCampaignId: string
}

export function ReviewerCampaignPage() {
  const navigate = useNavigate()
  const params = useParams<Params>() as Params
  const contextState = useAppSelector(selectTesterContext)
  const sessionsState = useAppSelector(selectReviewerSessions(params.reviewCampaignId))

  if (!ADS.isFulfilled(contextState) || !ADS.isFulfilled(sessionsState)) return null

  return (
    <ReviewerCampaignLanding
      context={contextState.value}
      sessions={sessionsState.value}
      onOpenSession={(sessionId) =>
        navigate(
          ReviewerRoutes.session.build({
            organizationId: params.organizationId,
            projectId: params.projectId,
            reviewCampaignId: params.reviewCampaignId,
            sessionId,
          }),
        )
      }
      onOpenReport={() =>
        navigate(
          ReviewerRoutes.report.build({
            organizationId: params.organizationId,
            projectId: params.projectId,
            reviewCampaignId: params.reviewCampaignId,
          }),
        )
      }
    />
  )
}

type LandingProps = {
  context: ReviewCampaignTesterContext
  sessions: ReviewerSessionListItem[]
  onOpenSession: (sessionId: string) => void
  onOpenReport: () => void
}

export function ReviewerCampaignLanding({
  context,
  sessions,
  onOpenSession,
  onOpenReport,
}: LandingProps) {
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
        action={
          <Button variant="outline" size="sm" onClick={onOpenReport}>
            <BarChartIcon /> {t("reviewerCampaigns:landing.campaignReport")}
          </Button>
        }
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
          <ReviewerSessionsTable sessions={sessions} onOpen={onOpenSession} />
        </section>
      </div>
    </>
  )
}
