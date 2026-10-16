import type { AgentMemoryDecision, AgentMemoryToolItem } from "./agent-memories.models"

/** Choice values of the approval questionnaire; any other answer is the user's rewording. */
export const MEMORY_DECISION_SAVE = "save"
export const MEMORY_DECISION_REJECT = "reject"

/**
 * The facts a saveMemory tool call reported (`toolCall.result`). Tolerates
 * anything malformed: an old or truncated tool call shows no card.
 */
export function parseSaveMemoryResult(result: unknown): AgentMemoryToolItem[] {
  if (!result || typeof result !== "object" || !("memories" in result)) return []
  const { memories } = result as { memories: unknown }
  if (!Array.isArray(memories)) return []
  return memories.filter(
    (memory): memory is AgentMemoryToolItem =>
      !!memory &&
      typeof memory === "object" &&
      typeof memory.id === "string" &&
      typeof memory.content === "string" &&
      (memory.status === "saved" || memory.status === "pending"),
  )
}

/**
 * Reads the questionnaire answers: one item per proposal, named by its id.
 * "save" and "reject" are the two choices; a typed answer saves the reworded
 * fact. A skipped proposal gets no decision and stays pending.
 */
export function decisionsFromAnswers(
  proposals: AgentMemoryToolItem[],
  getAnswers: (memoryId: string) => string[],
): AgentMemoryDecision[] {
  return proposals.flatMap((proposal): AgentMemoryDecision[] => {
    const answers = getAnswers(proposal.id)
      .map((answer) => answer.trim())
      .filter(Boolean)
    if (answers.includes(MEMORY_DECISION_REJECT)) {
      return [{ memoryId: proposal.id, decision: "reject" }]
    }
    const rewording = answers.find(
      (answer) => answer !== MEMORY_DECISION_SAVE && answer !== proposal.content,
    )
    if (rewording) return [{ memoryId: proposal.id, decision: "save", content: rewording }]
    if (answers.includes(MEMORY_DECISION_SAVE)) return [{ memoryId: proposal.id, decision: "save" }]
    return []
  })
}
