import type { ReviewerSessionOutputDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { AnswerList } from "@/components/shared/AnswerList"
import { PanelSection } from "@/components/shared/PanelSection"
import { StarRating } from "@/components/shared/StarRating"

export type TesterFeedbackPanelProps = {
  session: ReviewerSessionOutputDto
}

/**
 * What the tester said of their session. Before the reviewer's own review, only the factual
 * answers show; after it, the tester's rating, comment and every answer.
 */
export function TesterFeedbackPanel({ session }: TesterFeedbackPanelProps) {
  if (session.blind) {
    return (
      <PanelSection
        title={<Trans>Session facts</Trans>}
        description={<Trans>What the tester reported about what happened in this session.</Trans>}
      >
        <AnswerList
          questions={session.factualTesterQuestions}
          answers={session.factualTesterAnswers}
          empty={<Trans>This campaign asks its testers no factual question.</Trans>}
        />
      </PanelSection>
    )
  }
  return (
    <PanelSection title={<Trans>Tester feedback</Trans>}>
      {session.testerFeedback === null ? (
        <p className="text-sm text-muted-foreground italic">
          <Trans>The tester gave no feedback on this session.</Trans>
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              <Trans>Overall rating</Trans>
            </span>
            <StarRating rating={session.testerFeedback.overallRating} />
          </div>
          {session.testerFeedback.comment ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                <Trans>Comment</Trans>
              </span>
              <p className="text-sm whitespace-pre-wrap">{session.testerFeedback.comment}</p>
            </div>
          ) : null}
          {session.testerPerSessionQuestions.length > 0 ? (
            <AnswerList
              questions={session.testerPerSessionQuestions}
              answers={session.testerFeedback.answers}
              empty={null}
            />
          ) : null}
        </div>
      )}
    </PanelSection>
  )
}
