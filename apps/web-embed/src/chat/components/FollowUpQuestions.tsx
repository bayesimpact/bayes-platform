import { type AgentSessionMessageDto, ToolName } from "@caseai-connect/api-contracts"
import { useTranslation } from "react-i18next"

/**
 * The follow-up questions a reply suggests: those of its last
 * `suggestFollowUpQuestions` call, without empty entries.
 */
export function findFollowUpQuestions(toolCalls: AgentSessionMessageDto["toolCalls"]): string[] {
  const toolCall = (toolCalls ?? [])
    .filter((call) => call.name === ToolName.SuggestFollowUpQuestions)
    .at(-1)
  const questions = toolCall?.arguments.questions
  if (!Array.isArray(questions)) return []
  return questions.filter(
    (question): question is string => typeof question === "string" && question.trim().length > 0,
  )
}

/**
 * Index of the reply whose follow-up questions are shown: the last message of the
 * thread, when it is a finished reply. A message sent after it hides them. Tool rows
 * stored while the reply was written sort after it, so they are skipped.
 */
export function followUpReplyIndex(messages: AgentSessionMessageDto[]): number | undefined {
  let replyIndex = messages.length - 1
  while (messages[replyIndex]?.role === "tool") replyIndex -= 1
  const reply = messages[replyIndex]
  if (reply?.role !== "assistant" || reply.status === "streaming") return undefined
  return replyIndex
}

/** Follow-up questions under the last reply: a click sends the question as the next message. */
export function FollowUpQuestions({
  questions,
  onSelect,
}: {
  questions: string[]
  onSelect: (question: string) => void
}) {
  const { t } = useTranslation("chat")
  if (questions.length === 0) return null

  return (
    <ul aria-label={t("message.followUpQuestions")} className="mt-2 flex flex-wrap gap-2">
      {questions.map((question) => (
        <li key={question}>
          <button
            type="button"
            onClick={() => onSelect(question)}
            className="rounded-full border border-[var(--embed-primary)] bg-white px-3 py-1.5 text-left text-[var(--embed-primary)] text-sm transition-colors hover:bg-[var(--embed-primary)] hover:text-white"
          >
            {question}
          </button>
        </li>
      ))}
    </ul>
  )
}
