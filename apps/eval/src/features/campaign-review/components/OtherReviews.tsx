import type {
  ReviewCampaignQuestionDto,
  ReviewerReviewOutputDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans } from "@lingui/react/macro"
import { AnswerList } from "@/components/shared/AnswerList"
import { PanelSection } from "@/components/shared/PanelSection"
import { StarRating } from "@/components/shared/StarRating"
import { shortIdOf } from "@/lib/short-id"

export type OtherReviewsProps = {
  reviews: ReviewerReviewOutputDto[]
  questions: ReviewCampaignQuestionDto[]
}

/** The reviews the other reviewers gave, which show once the reviewer gave their own. */
export function OtherReviews({ reviews, questions }: OtherReviewsProps) {
  const count = reviews.length
  return (
    <PanelSection
      title={<Trans>Other reviewers</Trans>}
      aside={count > 0 ? <Plural value={count} one="# review" other="# reviews" /> : null}
    >
      {count === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          <Trans>You are the only reviewer of this session so far.</Trans>
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {reviews.map((review) => {
            const reviewerId = shortIdOf(review.reviewerUserId)
            return (
              <li key={review.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    <Trans comment="Names a reviewer by the start of their id">
                      Reviewer <span className="font-mono text-xs">{reviewerId}</span>
                    </Trans>
                  </span>
                  <StarRating rating={review.overallRating} />
                </div>
                {review.comment ? (
                  <p className="text-sm whitespace-pre-wrap">{review.comment}</p>
                ) : null}
                {questions.length > 0 ? (
                  <AnswerList questions={questions} answers={review.answers} empty={null} />
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </PanelSection>
  )
}
