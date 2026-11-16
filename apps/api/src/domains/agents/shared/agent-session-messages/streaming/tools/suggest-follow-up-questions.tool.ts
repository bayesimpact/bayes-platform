import { ToolName } from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import type { ToolExecutionLog } from "./tool-execution-log"

/** A chip holds one short line: a longer question is dropped. */
export const FOLLOW_UP_QUESTION_MAX_LENGTH = 200

type FollowUpSuggestionsSettings = {
  followUpSuggestionsInstructions: string | null
  followUpSuggestionsMax: number
}

/**
 * Line of the master prompt's tools section. The author's instructions come
 * last, so they can narrow when the questions are suggested.
 */
export function suggestFollowUpQuestionsInstruction({
  followUpSuggestionsInstructions,
  followUpSuggestionsMax,
}: FollowUpSuggestionsSettings): string {
  const base = `After your answer, when it helps the user continue the conversation, call ${ToolName.SuggestFollowUpQuestions} with at most ${followUpSuggestionsMax} short follow-up questions the user could send you next. Write each question as the user would ask it, in the user's language, on one line. The questions are shown as buttons under your answer: write your full answer as text first, and never repeat the questions in your text. Do not call the tool when no follow-up question is relevant.`
  const authorInstructions = followUpSuggestionsInstructions?.trim()
  return authorInstructions
    ? `${base} Instructions for these questions: ${authorInstructions}`
    : base
}

/**
 * Keeps the questions a chip can show: trimmed, non-empty, short, without
 * duplicates, and no more than the agent's maximum. The model may ignore the
 * maximum in its call, so it is enforced here instead of in the input schema
 * (a schema error would make the model retry and pay one more generation).
 */
export function cleanFollowUpQuestions(questions: string[], maxQuestions: number): string[] {
  const seen = new Set<string>()
  const cleaned: string[] = []
  for (const question of questions) {
    const trimmed = question.trim()
    const key = trimmed.toLowerCase()
    if (!trimmed || trimmed.length > FOLLOW_UP_QUESTION_MAX_LENGTH || seen.has(key)) continue
    seen.add(key)
    cleaned.push(trimmed)
    if (cleaned.length >= maxQuestions) break
  }
  return cleaned
}

/**
 * Fire-and-forget: the questions are stored on the assistant message as a tool
 * call (`arguments.questions`) and shown as chips by the chats. The model never
 * needs the output, so the tool loop stops after it (see
 * FIRE_AND_FORGET_TOOL_NAMES) and no second generation is paid.
 */
export function suggestFollowUpQuestionsTool({
  followUpSuggestionsMax,
  onExecute,
  onSuggested,
}: {
  followUpSuggestionsMax: number
  onExecute: (toolExecution: ToolExecutionLog) => void | Promise<void>
  /** Called once questions were stored: the post-turn classifier then skips them. */
  onSuggested?: () => void
}) {
  return tool({
    description: `Show the user up to ${followUpSuggestionsMax} short follow-up questions as buttons under your answer. A click sends the question as the user's next message. Call it after your answer, only when a follow-up question is relevant.`,
    inputSchema: z.object({
      questions: z
        .array(z.string())
        .min(1)
        .describe(
          `At most ${followUpSuggestionsMax} short questions, each written as the user would ask it, in the user's language.`,
        ),
    }),
    outputSchema: z.object({
      role: z.literal("system"),
      content: z.string().describe("The content of the system message."),
    }),
    execute: async (input) => {
      const questions = cleanFollowUpQuestions(input.questions, followUpSuggestionsMax)
      if (questions.length > 0) {
        await onExecute({
          toolName: ToolName.SuggestFollowUpQuestions,
          arguments: { questions },
        })
        onSuggested?.()
      }
      return {
        role: "system",
        content:
          "Follow-up questions shown to the user as buttons. Do not repeat them in your text.",
      }
    },
  })
}
