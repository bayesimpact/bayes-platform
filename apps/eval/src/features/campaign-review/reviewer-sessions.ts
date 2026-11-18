import type { ReviewerSessionListItemOutputDto } from "@caseai-connect/eval-contracts"

/**
 * The sessions of a campaign as a reviewer works through them: the ones still to review, then the
 * ones they reviewed. A session they started as a tester is in neither: they cannot review it.
 */
export function splitReviewerSessions(sessions: ReviewerSessionListItemOutputDto[]) {
  const reviewable = sessions.filter((session) => !session.callerIsSessionOwner)
  return {
    toReview: reviewable.filter((session) => !session.callerHasReviewed),
    reviewed: reviewable.filter((session) => session.callerHasReviewed),
  }
}
