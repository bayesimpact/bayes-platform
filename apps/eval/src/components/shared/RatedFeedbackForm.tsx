import type {
  RatedFeedbackInputDto,
  ReviewCampaignQuestionDto,
} from "@caseai-connect/eval-contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trans } from "@lingui/react/macro"
import { type ReactNode, useId } from "react"
import { Controller, useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  type RatedFeedback,
  ratedFeedbackFormSchema,
  ratedFeedbackInputOf,
  ratedFeedbackValuesOf,
} from "@/lib/rated-feedback"
import { QuestionField } from "./QuestionField"
import { StarRatingInput } from "./StarRatingInput"

export type RatedFeedbackFormProps = {
  questions: ReviewCampaignQuestionDto[]
  /** What the person gave before, to change it, or `null` for a first answer. */
  feedback: RatedFeedback | null
  /** The label of the rating, such as "Overall rating". */
  ratingLabel: ReactNode
  commentPlaceholder: string
  submitLabel: ReactNode
  /** A second button beside the submit, such as a way back. */
  secondaryAction?: ReactNode
  /** While the answer is sent, the button waits. */
  isPending: boolean
  /** A closed campaign shows the form as it was answered, and takes no change. */
  disabled?: boolean
  onSubmit: (input: RatedFeedbackInputDto) => void
}

/**
 * The form a tester or a reviewer fills: a rating out of five, a comment, and the campaign's
 * questions. It asks for the rating and for every required question before it sends.
 */
export function RatedFeedbackForm({
  questions,
  feedback,
  ratingLabel,
  commentPlaceholder,
  submitLabel,
  secondaryAction,
  isPending,
  disabled = false,
  onSubmit,
}: RatedFeedbackFormProps) {
  const ratingLabelId = useId()
  const commentId = useId()
  const form = useForm({
    resolver: zodResolver(ratedFeedbackFormSchema(questions)),
    defaultValues: ratedFeedbackValuesOf(questions, feedback),
  })

  const handleSubmit = form.handleSubmit((values) => {
    const input = ratedFeedbackInputOf(questions, values)
    if (input) onSubmit(input)
  })

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-5" noValidate>
      <Controller
        control={form.control}
        name="overallRating"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel id={ratingLabelId}>
              {ratingLabel}
              <span aria-hidden className="text-destructive">
                *
              </span>
            </FieldLabel>
            <StarRatingInput
              aria-labelledby={ratingLabelId}
              value={field.value}
              onChange={field.onChange}
              isInvalid={fieldState.invalid}
              disabled={disabled}
            />
            {fieldState.invalid ? (
              <FieldError>
                <Trans>Give a rating from 1 to 5 stars.</Trans>
              </FieldError>
            ) : null}
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="comment"
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor={commentId}>
              <Trans>Comment</Trans>
            </FieldLabel>
            <Textarea
              {...field}
              id={commentId}
              rows={3}
              placeholder={commentPlaceholder}
              disabled={disabled}
            />
          </Field>
        )}
      />
      {questions.map((question) => (
        <Controller
          key={question.id}
          control={form.control}
          name={`answers.${question.id}`}
          render={({ field, fieldState }) => (
            <QuestionField
              question={question}
              value={field.value ?? null}
              onChange={field.onChange}
              isInvalid={fieldState.invalid}
              disabled={disabled}
            />
          )}
        />
      ))}
      {disabled ? null : (
        <div className="flex flex-wrap justify-end gap-2">
          {secondaryAction}
          <Button type="submit" disabled={isPending}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}
