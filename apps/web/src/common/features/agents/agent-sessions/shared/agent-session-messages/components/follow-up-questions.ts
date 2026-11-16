import { type AgentSessionToolName, ToolName } from "@caseai-connect/api-contracts"

type ToolCall = { name: AgentSessionToolName; arguments: Record<string, unknown> }

/**
 * The follow-up questions a reply suggests: those of its last
 * `suggestFollowUpQuestions` call, without empty entries.
 */
export function findFollowUpQuestions(toolCalls: ToolCall[] | undefined): string[] {
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
 * persisted while the reply was written sort after it, so they are skipped.
 */
export function followUpReplyIndex(
  messages: { role: string; status?: string }[],
): number | undefined {
  let replyIndex = messages.length - 1
  while (messages[replyIndex]?.role === "tool") replyIndex -= 1
  const reply = messages[replyIndex]
  if (reply?.role !== "assistant" || reply.status === "streaming") return undefined
  return replyIndex
}
