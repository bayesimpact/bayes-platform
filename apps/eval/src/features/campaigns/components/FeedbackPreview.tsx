import type { ReviewCampaignQuestionDto } from "@caseai-connect/eval-contracts"
import { Plural, Trans } from "@lingui/react/macro"
import { ChevronDownIcon } from "lucide-react"
import type { ReactNode } from "react"
import { type Control, useWatch } from "react-hook-form"
import { QuestionField } from "@/components/shared/QuestionField"
import { SidePanel } from "@/components/shared/SidePanel"
import { StarRatingInput } from "@/components/shared/StarRatingInput"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { previewQuestionOf } from "../campaign-form"
import type { CampaignFormValues, QuestionListName } from "../schemas"

export type FeedbackPreviewProps = {
  control: Control<CampaignFormValues>
  onClose: () => void
  /** Whether the panel takes the focus: one the person opened does, one shown from the start not. */
  takesFocus: boolean
  /** The form of the setup's current step, the only one open at first; none opens them all. */
  currentList?: QuestionListName
}

const ignoreChange = () => {}

/**
 * What testers and reviewers will fill, as the setup stands, saved or not: the three forms, which
 * take no answer here, in a panel beside the setup that follows what the person writes. Each form
 * folds to its title; in the setup's steps, only the current step's form opens at first.
 */
export function FeedbackPreview({
  control,
  onClose,
  takesFocus,
  currentList,
}: FeedbackPreviewProps) {
  const [perSession, endOfPhase, reviewer] = useWatch({
    control,
    name: ["testerPerSessionQuestions", "testerEndOfPhaseQuestions", "reviewerQuestions"],
  })
  const isOpenAtFirst = (list: QuestionListName) =>
    currentList === undefined || currentList === list
  return (
    <SidePanel
      title={<Trans comment="The panel that shows the forms of a campaign">Preview</Trans>}
      description={<Trans>The forms testers and reviewers will fill, as the setup stands.</Trans>}
      onClose={onClose}
      takesFocus={takesFocus}
    >
      {/* Another step starts afresh: its own form opens, the others fold. */}
      <div key={currentList} className="flex flex-col gap-4">
        <PreviewForm
          title={<Trans>After each session</Trans>}
          description={<Trans>What a tester fills when they end a session.</Trans>}
          ratingLabel={<Trans>Overall rating</Trans>}
          questions={perSession.map(previewQuestionOf)}
          isOpenAtFirst={isOpenAtFirst("testerPerSessionQuestions")}
        />
        <PreviewForm
          title={<Trans>Final survey</Trans>}
          description={<Trans>What a tester fills when they finish taking part.</Trans>}
          ratingLabel={<Trans>Overall rating</Trans>}
          questions={endOfPhase.map(previewQuestionOf)}
          isOpenAtFirst={isOpenAtFirst("testerEndOfPhaseQuestions")}
        />
        <PreviewForm
          title={<Trans>Session review</Trans>}
          description={<Trans>What a reviewer fills for each session.</Trans>}
          ratingLabel={<Trans>Your rating</Trans>}
          questions={reviewer.map(previewQuestionOf)}
          isOpenAtFirst={isOpenAtFirst("reviewerQuestions")}
        />
      </div>
    </SidePanel>
  )
}

type PreviewFormProps = {
  title: ReactNode
  description: ReactNode
  ratingLabel: ReactNode
  questions: ReviewCampaignQuestionDto[]
  isOpenAtFirst: boolean
}

/** One form of the preview, which folds to its title. */
function PreviewForm({
  title,
  description,
  ratingLabel,
  questions,
  isOpenAtFirst,
}: PreviewFormProps) {
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
