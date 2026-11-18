import { Trans } from "@lingui/react/macro"
import { type Control, useWatch } from "react-hook-form"
import { SidePanel } from "@/components/shared/SidePanel"
import { previewQuestionOf } from "../campaign-form"
import type { CampaignFormValues, QuestionListName } from "../schemas"
import { FeedbackFormPreview } from "./FeedbackFormPreview"

export type FeedbackPreviewProps = {
  control: Control<CampaignFormValues>
  onClose: () => void
  /** Whether the panel takes the focus: one the person opened does, one shown from the start not. */
  takesFocus: boolean
  /** The form of the setup's current step, the only one open at first; none opens them all. */
  currentList?: QuestionListName
}

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
        <FeedbackFormPreview
          title={<Trans>After each session</Trans>}
          description={<Trans>What a tester fills when they end a session.</Trans>}
          ratingLabel={<Trans>Overall rating</Trans>}
          questions={perSession.map(previewQuestionOf)}
          isOpenAtFirst={isOpenAtFirst("testerPerSessionQuestions")}
        />
        <FeedbackFormPreview
          title={<Trans>Final survey</Trans>}
          description={<Trans>What a tester fills when they finish taking part.</Trans>}
          ratingLabel={<Trans>Overall rating</Trans>}
          questions={endOfPhase.map(previewQuestionOf)}
          isOpenAtFirst={isOpenAtFirst("testerEndOfPhaseQuestions")}
        />
        <FeedbackFormPreview
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
