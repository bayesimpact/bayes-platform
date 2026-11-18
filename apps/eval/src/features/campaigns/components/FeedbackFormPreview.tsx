import type { ReviewCampaignQuestionDto } from "@caseai-connect/eval-contracts"
import { Plural, Trans } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { FoldingCard } from "@/components/shared/FoldingCard"
import { QuestionField } from "@/components/shared/QuestionField"
import { StarRatingInput } from "@/components/shared/StarRatingInput"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

const ignoreChange = () => {}

export type FeedbackFormPreviewProps = {
  title: ReactNode
  description: ReactNode
  ratingLabel: ReactNode
  questions: ReviewCampaignQuestionDto[]
  isOpenAtFirst: boolean
}

/**
 * One form of a campaign as its testers or reviewers will fill it, taking no answer here: its
 * rating, its comment and its questions. It folds to its title and question count.
 */
export function FeedbackFormPreview({
  title,
  description,
  ratingLabel,
  questions,
  isOpenAtFirst,
}: FeedbackFormPreviewProps) {
  const questionCount = questions.length
  return (
    <FoldingCard
      title={title}
      description={description}
      aside={<Plural value={questionCount} one="# question" other="# questions" />}
      isOpenAtFirst={isOpenAtFirst}
    >
      {/* Inert: the preview shows the form, and answers nothing. */}
      <div inert className="flex flex-col gap-5 p-3">
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
    </FoldingCard>
  )
}
