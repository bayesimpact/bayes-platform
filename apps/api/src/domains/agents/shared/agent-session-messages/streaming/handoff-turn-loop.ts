import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"

/** Which agent answers the next turn of a session, and with which settings. */
export type ActiveTurnAgent = {
  agent: Agent
  agentSettings: AgentSettings
  /** Set when the agent is a sub-agent in control of the conversation (handoff). */
  handoff?: { parentAgent: Agent }
}

/**
 * Hard cap on the turns one user message can produce: the parent's hand-over
 * sentence, the child's first turn, and, when the child concludes at once, the
 * parent's resumption. Two agents handing the conversation to each other can
 * never run away within one response.
 */
export const MAX_HANDOFF_TURNS = 4

/**
 * Triggers for the turns the user did not type, sent as a user-role message
 * for that call only and never persisted (see AgentLlmRequestService).
 */
export const CHILD_FIRST_TURN_TRIGGER =
  "(platform trigger, not a message from the user: ignore its literal content) The conversation " +
  "was just handed to you. Answer what the user last said if it concerns you; otherwise greet them " +
  "briefly and ask your first question."

export const PARENT_RESUME_TRIGGER =
  "(platform trigger, not a message from the user: ignore its literal content) The agent you handed " +
  "the conversation to has concluded. Continue the conversation: decide the next step as you would " +
  "after any other turn."

/**
 * One user message, one to several turns. The agent in control answers; when
 * its turn moved control to another agent (a handoff, or a conclusion), that
 * agent's turn follows in the same response, so the user never sees a hand-over
 * sentence without the next question. The platform never chooses who speaks:
 * it re-reads the session's active agent after each turn and only removes the
 * round trip once an agent has decided.
 */
export async function* runHandoffTurns<TEvent>({
  userContent,
  resolveActiveAgent,
  runTurn,
}: {
  userContent: string
  /** Re-read from the session before each turn: the last turn's tools may have changed it. */
  resolveActiveAgent: () => Promise<ActiveTurnAgent>
  runTurn: (params: {
    active: ActiveTurnAgent
    userContent: string
    /** False for a platform trigger: the message is sent to the model, not stored. */
    persistUserMessage: boolean
  }) => AsyncGenerator<TEvent, void, unknown>
}): AsyncGenerator<TEvent, void, unknown> {
  let active = await resolveActiveAgent()
  let content = userContent
  let persistUserMessage = true

  for (let step = 0; step < MAX_HANDOFF_TURNS; step++) {
    const ranAgentId = active.agent.id
    yield* runTurn({ active, userContent: content, persistUserMessage })

    const next = await resolveActiveAgent()
    if (next.agent.id === ranAgentId) break

    content = next.handoff ? CHILD_FIRST_TURN_TRIGGER : PARENT_RESUME_TRIGGER
    persistUserMessage = false
    active = next
  }
}
