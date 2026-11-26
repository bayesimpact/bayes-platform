import { Button } from "@caseai-connect/app-ui/components/button"
import { useLingui } from "@lingui/react/macro"

export type FollowUpQuestionsProps = {
  questions: string[]
  onSelect: (question: string) => void
}

/** The questions a reply suggests, as buttons: a click sends one as the person's next message. */
export function FollowUpQuestions({ questions, onSelect }: FollowUpQuestionsProps) {
  const { t } = useLingui()
  return (
    <ul aria-label={t`Suggested questions`} className="flex flex-wrap gap-2">
      {questions.map((question) => (
        <li key={question}>
          <Button
            variant="outline"
            size="sm"
            className="h-auto rounded-full py-1.5 text-left whitespace-normal"
            onClick={() => onSelect(question)}
          >
            {question}
          </Button>
        </li>
      ))}
    </ul>
  )
}
