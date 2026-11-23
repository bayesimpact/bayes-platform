import type {
  ReviewCampaignAnswerDto,
  ReviewCampaignQuestionDto,
} from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { StarRating } from "./StarRating"

export type AnswerListProps = {
  questions: ReviewCampaignQuestionDto[]
  answers: ReviewCampaignAnswerDto[]
  /** What the list says when the campaign asks no question here. */
  empty: ReactNode
}

/** The questions of a campaign with the answers someone gave: stars for a rating, the text otherwise. */
export function AnswerList({ questions, answers, empty }: AnswerListProps) {
  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground italic">{empty}</p>
  }
  const valueByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer.value]))
  return (
    <dl className="flex flex-col gap-3">
      {questions.map((question) => {
        const value = valueByQuestionId.get(question.id)
        return (
          <div key={question.id} className="flex flex-col gap-1">
            <dt className="text-sm font-medium">{question.prompt}</dt>
            <dd className="text-sm">
              {value === undefined ? (
                <span className="text-muted-foreground italic">
                  <Trans>Not answered</Trans>
                </span>
              ) : typeof value === "number" ? (
                <StarRating rating={value} />
              ) : Array.isArray(value) ? (
                value.join(", ")
              ) : (
                <span className="whitespace-pre-wrap">{value}</span>
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
