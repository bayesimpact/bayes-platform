import { Button } from "@caseai-connect/ui/shad/button"
import { useTranslation } from "react-i18next"

/** Follow-up questions under a reply: a click sends the question as the next user message. */
export function FollowUpQuestions({
  questions,
  disabled,
  onSelect,
}: {
  questions: string[]
  disabled?: boolean
  onSelect: (question: string) => void
}) {
  const { t } = useTranslation()
  if (questions.length === 0) return null

  return (
    <ul
      aria-label={t("agentSessionMessage:followUpQuestions")}
      className="mt-2 flex w-full flex-wrap gap-2"
    >
      {questions.map((question) => (
        <li key={question}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto whitespace-normal rounded-full px-3 py-1.5 text-left"
            disabled={disabled}
            onClick={() => onSelect(question)}
          >
            {question}
          </Button>
        </li>
      ))}
    </ul>
  )
}
