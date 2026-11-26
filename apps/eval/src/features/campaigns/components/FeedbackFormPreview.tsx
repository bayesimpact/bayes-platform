import type { ReviewCampaignQuestionDto } from "@bayes-platform/eval-contracts"
import { Plural } from "@lingui/react/macro"
import type { ReactNode } from "react"
import { FoldingCard } from "@/components/shared/FoldingCard"
import { FeedbackFormFields } from "./FeedbackFormFields"

export type FeedbackFormPreviewProps = {
  title: ReactNode
  description: ReactNode
  ratingLabel: ReactNode
  questions: ReviewCampaignQuestionDto[]
  isOpenAtFirst: boolean
}

/** One form of a campaign as its testers or reviewers will fill it, folded to its title. */
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
      <FeedbackFormFields
        ratingLabel={ratingLabel}
        questions={questions}
        className="flex flex-col gap-5 p-3"
      />
    </FoldingCard>
  )
}
