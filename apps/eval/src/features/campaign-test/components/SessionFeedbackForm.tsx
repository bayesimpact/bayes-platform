import type {
  CampaignContextOutputDto,
  ReviewCampaignParamsDto,
} from "@bayes-platform/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { toast } from "sonner"
import { RatedFeedbackForm } from "@/components/shared/RatedFeedbackForm"
import { Button } from "@/components/ui/button"
import { useSubmitFeedback } from "../api/mutations"

export type SessionFeedbackFormProps = {
  campaign: ReviewCampaignParamsDto
  context: CampaignContextOutputDto
  sessionId: string
  onCancel: () => void
  /** Called once the feedback is saved. */
  onSubmitted: () => void
}

/** Asks a tester how a session went: a rating, a comment and the campaign's questions. */
export function SessionFeedbackForm({
  campaign,
  context,
  sessionId,
  onCancel,
  onSubmitted,
}: SessionFeedbackFormProps) {
  const { t } = useLingui()
  const submitFeedback = useSubmitFeedback(campaign)
  return (
    <RatedFeedbackForm
      questions={context.testerPerSessionQuestions}
      feedback={null}
      ratingLabel={<Trans>Overall rating</Trans>}
      commentPlaceholder={t`Anything we should know about this session?`}
      submitLabel={<Trans>Submit feedback</Trans>}
      secondaryAction={
        <Button type="button" variant="outline" onClick={onCancel}>
          <Trans>Cancel</Trans>
        </Button>
      }
      isPending={submitFeedback.isPending}
      onSubmit={(feedback) =>
        submitFeedback.mutate(
          { sessionId, feedback },
          {
            onSuccess: () => {
              toast.success(t`Your feedback was saved.`)
              onSubmitted()
            },
            // The form stays open with what was written.
            onError: () => toast.error(t`Your feedback could not be saved. Try again.`),
          },
        )
      }
    />
  )
}
