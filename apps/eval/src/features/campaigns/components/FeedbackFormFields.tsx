import type { ReviewCampaignQuestionDto } from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { QuestionField } from "@/components/shared/QuestionField"
import { StarRatingInput } from "@/components/shared/StarRatingInput"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

const ignoreChange = () => {}

export type FeedbackFormFieldsProps = {
  ratingLabel: ReactNode
  questions: ReviewCampaignQuestionDto[]
  className?: string
}

/**
 * The fields of one form of a campaign as its testers or reviewers will fill it: its rating, its
 * comment and its questions. Inert: they show the form, and take no answer.
 */
export function FeedbackFormFields({ ratingLabel, questions, className }: FeedbackFormFieldsProps) {
  return (
    <div inert className={className ?? "flex flex-col gap-5"}>
      <Field>
        <FieldLabel>
          {ratingLabel}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </FieldLabel>
        <StarRatingInput value={null} onChange={ignoreChange} disabled />
      </Field>
      <Field>
        <FieldLabel>
          <Trans>Comment</Trans>
        </FieldLabel>
        <Textarea rows={2} disabled />
      </Field>
      {questions.map((question) => (
        <QuestionField
          key={question.id}
          question={question}
          value={null}
          onChange={ignoreChange}
          disabled
        />
      ))}
    </div>
  )
}
