import type { ReviewCampaignParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { SidebarSessionItem } from "@/components/shared/SidebarSessionItem"
import { SidebarMenuSub } from "@/components/ui/sidebar"
import { shortDateTimeOf } from "@/lib/format-time"
import { reviewerSessionsQueryOptions } from "../api/queries"

export type ReviewerSessionLinksProps = {
  campaign: ReviewCampaignParamsDto
}

/**
 * The sessions of the open campaign, under it in the sidebar, for one of its reviewers: those to
 * review first, then those they reviewed. A session they started as a tester is not theirs to
 * review.
 */
export function ReviewerSessionLinks({ campaign }: ReviewerSessionLinksProps) {
  const { t, i18n } = useLingui()
  const { data: sessions } = useSuspenseQuery(reviewerSessionsQueryOptions(campaign))
  const reviewable = sessions.filter((session) => !session.callerIsSessionOwner)
  const ordered = [
    ...reviewable.filter((session) => !session.callerHasReviewed),
    ...reviewable.filter((session) => session.callerHasReviewed),
  ]
  if (ordered.length === 0) {
    return (
      <p className="px-4 py-1 text-xs text-muted-foreground">
        <Trans>No session to review yet.</Trans>
      </p>
    )
  }
  return (
    <SidebarMenuSub className="mr-0 pr-0">
      {ordered.map((session) => (
        <SidebarSessionItem
          key={session.sessionId}
          link={
            <Link
              to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review/sessions/$sessionId"
              params={{ ...campaign, sessionId: session.sessionId }}
              activeProps={{ "data-active": true }}
            />
          }
          label={shortDateTimeOf(session.startedAt, i18n.locale)}
          isDone={session.callerHasReviewed}
          stateLabel={session.callerHasReviewed ? t`Reviewed` : t`To review`}
        />
      ))}
    </SidebarMenuSub>
  )
}
