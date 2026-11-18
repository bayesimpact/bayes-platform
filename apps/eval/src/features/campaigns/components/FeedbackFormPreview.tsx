import type { ReviewCampaignQuestionDto } from "@caseai-connect/eval-contracts"
import { Plural, Trans } from "@lingui/react/macro"
import { ChevronDownIcon } from "lucide-react"
import type { ReactNode } from "react"
import { QuestionField } from "@/components/shared/QuestionField"
import { StarRatingInput } from "@/components/shared/StarRatingInput"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
    <Collapsible
      defaultOpen={isOpenAtFirst}
      render={<section className="overflow-hidden rounded-lg border" />}
    >
      <h3>
        <CollapsibleTrigger className="group/preview flex w-full flex-col gap-1 bg-muted/50 px-3 py-2.5 text-left hover:bg-muted aria-expanded:border-b">
          <span className="flex w-full items-center justify-between gap-2">
            <span className="text-base font-semibold">{title}</span>
            <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
              <Plural value={questionCount} one="# question" other="# questions" />
              <ChevronDownIcon
                aria-hidden
                className="size-4 transition-transform group-not-aria-expanded/preview:-rotate-90"
              />
            </span>
          </span>
          <span className="text-muted-foreground">{description}</span>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent>
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
      </CollapsibleContent>
    </Collapsible>
  )
}
