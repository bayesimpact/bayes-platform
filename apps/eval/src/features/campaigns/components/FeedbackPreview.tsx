import type { ReviewCampaignQuestionDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { type Control, useWatch } from "react-hook-form"
import { PanelSection } from "@/components/shared/PanelSection"
import { QuestionField } from "@/components/shared/QuestionField"
import { SidePanel } from "@/components/shared/SidePanel"
import { StarRatingInput } from "@/components/shared/StarRatingInput"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { previewQuestionOf } from "../campaign-form"
import type { CampaignFormValues } from "../schemas"

export type FeedbackPreviewProps = {
  control: Control<CampaignFormValues>
  onClose: () => void
  /** Whether the panel takes the focus: one the person opened does, one shown from the start not. */
  takesFocus: boolean
}

const ignoreChange = () => {}

/**
 * What testers and reviewers will fill, as the setup stands, saved or not: the three forms, which
 * take no answer here, in a panel beside the setup that follows what the person writes.
 */
export function FeedbackPreview({ control, onClose, takesFocus }: FeedbackPreviewProps) {
  const [perSession, endOfPhase, reviewer] = useWatch({
    control,
    name: ["testerPerSessionQuestions", "testerEndOfPhaseQuestions", "reviewerQuestions"],
  })
  return (
    <SidePanel
      title={<Trans comment="The panel that shows the forms of a campaign">Preview</Trans>}
      description={<Trans>The forms testers and reviewers will fill, as the setup stands.</Trans>}
      onClose={onClose}
      takesFocus={takesFocus}
    >
      <div className="flex flex-col gap-4">
        <PreviewForm
          title={<Trans>After each session</Trans>}
          description={<Trans>What a tester fills when they end a session.</Trans>}
          ratingLabel={<Trans>Overall rating</Trans>}
          questions={perSession.map(previewQuestionOf)}
        />
        <PreviewForm
          title={<Trans>Final survey</Trans>}
          description={<Trans>What a tester fills when they finish taking part.</Trans>}
          ratingLabel={<Trans>Overall rating</Trans>}
          questions={endOfPhase.map(previewQuestionOf)}
        />
        <PreviewForm
          title={<Trans>Review of a session</Trans>}
          description={<Trans>What a reviewer fills for each session.</Trans>}
          ratingLabel={<Trans>Your rating</Trans>}
          questions={reviewer.map(previewQuestionOf)}
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
}

function PreviewForm({ title, description, ratingLabel, questions }: PreviewFormProps) {
  return (
    <PanelSection title={title} description={description}>
      {/* Inert: the preview shows the form, and answers nothing. */}
      <div inert className="flex flex-col gap-5">
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
    </PanelSection>
  )
}
