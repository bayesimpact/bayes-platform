import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"
import { Plural, Trans } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { BarChart3Icon } from "lucide-react"
import { CampaignStatusBadge } from "@/components/shared/CampaignStatusBadge"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { SectionCard } from "@/components/shared/SectionCard"
import { buttonVariants } from "@/components/ui/button"
import { CampaignAgentCard, useCampaignContext } from "@/features/campaign-context"
import { reviewerSessionsQueryOptions } from "../api/queries"
import { ReviewerSessionsTable } from "./ReviewerSessionsTable"

export type ReviewerCampaignPageProps = {
  campaign: ReviewCampaignParamsDto
}

/** A campaign for one of its reviewers: the agent, the sessions to review and the report. */
export function ReviewerCampaignPage({ campaign }: ReviewerCampaignPageProps) {
  const context = useCampaignContext(campaign)
  const { data: sessions } = useSuspenseQuery(reviewerSessionsQueryOptions(campaign))
  const total = sessions.length
  const pending = sessions.filter(
    (session) => !session.callerHasReviewed && !session.callerIsSessionOwner,
  ).length
  return (
    <PageContainer>
      <PageHeader
        title={context.name}
        badge={<CampaignStatusBadge status={context.status} />}
        description={context.description}
        actions={
          <Link
            to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review/report"
            params={campaign}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <BarChart3Icon data-icon="inline-start" aria-hidden />
            <Trans>Report</Trans>
          </Link>
        }
      />
      <CampaignAgentCard agent={context.agent} />
      <SectionCard
        title={<Trans>Sessions to review</Trans>}
        description={
          context.status === "active" ? (
            <Trans>
              Read a session, then give your own rating. The tester's opinion stays hidden until you
              do.
            </Trans>
          ) : (
            <Trans>The campaign is closed: you can read the sessions and the reviews.</Trans>
          )
        }
        aside={
          <span>
            <Plural value={total} one="# session" other="# sessions" />
            {pending > 0 ? (
              <>
                {" · "}
                <Plural value={pending} one="# to review" other="# to review" />
              </>
            ) : null}
          </span>
        }
      >
        <ReviewerSessionsTable campaign={campaign} sessions={sessions} />
      </SectionCard>
    </PageContainer>
  )
}
