import type {
  CampaignSessionParamsDto,
  ReviewerSessionOutputDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { EyeOffIcon } from "lucide-react"
import { toast } from "sonner"
import { PanelSection } from "@/components/shared/PanelSection"
import { RatedFeedbackForm } from "@/components/shared/RatedFeedbackForm"
import { useSaveReview } from "../api/mutations"

export type ReviewPanelProps = {
  sessionParams: CampaignSessionParamsDto
  session: ReviewerSessionOutputDto
  /** Whether the campaign still takes reviews: a closed one shows the review as it is. */
  isOpen: boolean
}

/** The reviewer's own review of the session: a first one while blind, then one they can change. */
export function ReviewPanel({ sessionParams, session, isOpen }: ReviewPanelProps) {
  const { t } = useLingui()
  const myReview = session.blind ? null : session.myReview
  const saveReview = useSaveReview(sessionParams, myReview?.id ?? null)
  const otherCount = session.otherReviewerCount
  return (
    <PanelSection
      title={<Trans>Your review</Trans>}
      description={
        session.blind && otherCount > 0 ? (
          <Plural
            value={otherCount}
            one="# other reviewer reviewed this session."
            other="# other reviewers reviewed this session."
          />
        ) : undefined
      }
    >
      {session.blind && isOpen ? (
        <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
          <EyeOffIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <Trans>
            The tester's rating and comment stay hidden until you submit your own review, so your
            judgment stays independent.
          </Trans>
        </p>
      ) : null}
      {session.blind && !isOpen ? (
        <p className="text-sm text-muted-foreground italic">
          <Trans>The campaign closed before you reviewed this session.</Trans>
        </p>
      ) : (
        <RatedFeedbackForm
          // The form starts again from the review once it is saved.
          key={myReview?.id ?? "new"}
          questions={session.reviewerQuestions}
          feedback={myReview}
          ratingLabel={<Trans>Your rating</Trans>}
          commentPlaceholder={t`What worked, and what did not?`}
          submitLabel={myReview ? <Trans>Save changes</Trans> : <Trans>Submit review</Trans>}
          isPending={saveReview.isPending}
          disabled={!isOpen}
          onSubmit={(input) =>
            saveReview.mutate(input, {
              onSuccess: () => toast.success(t`Your review was saved.`),
              onError: () => toast.error(t`Your review could not be saved. Try again.`),
            })
          }
        />
      )}
    </PanelSection>
  )
}
