import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"
import { Plural, Trans } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { SectionCard } from "@/components/shared/SectionCard"
import { ParticipantCampaignFrame, useCampaignContext } from "@/features/campaign-context"
import { reviewerSessionsQueryOptions } from "../api/queries"
import { ReviewerSessionsTable } from "./ReviewerSessionsTable"

export type ReviewerCampaignPageProps = {
  campaign: ReviewCampaignParamsDto
}

/** A campaign for one of its reviewers, its first tab: the agent and the sessions to review. */
export function ReviewerCampaignPage({ campaign }: ReviewerCampaignPageProps) {
  const context = useCampaignContext(campaign)
  const { data: sessions } = useSuspenseQuery(reviewerSessionsQueryOptions(campaign))
  const total = sessions.length
  const pending = sessions.filter(
    (session) => !session.callerHasReviewed && !session.callerIsSessionOwner,
  ).length
  return (
    <ParticipantCampaignFrame campaign={campaign} campaignRole="reviewer" currentTab="overview">
      {/* The table has its own frame: the block of the sessions needs none around it. */}
      <SectionCard
        className="rounded-none border-0 bg-transparent p-0 md:p-0 dark:bg-transparent"
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
    </ParticipantCampaignFrame>
  )
}
