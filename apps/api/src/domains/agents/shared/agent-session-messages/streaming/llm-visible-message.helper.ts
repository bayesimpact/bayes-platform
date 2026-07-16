import type { AgentMessage } from "../agent-message.entity"

/**
 * Whether a stored session message is eligible to be shown to an LLM: only
 * settled user/assistant turns with real content. Excludes streaming messages
 * (not complete yet), aborted messages, error messages (their content is raw
 * provider error text), and empty messages (the AI SDK requires non-empty
 * content).
 *
 * Shared by the parent-session history sent to the LLM and the recent-parent
 * conversation transcript handed to sub-agents, so both always apply the same
 * eligibility rules.
 */
export function isLLMVisibleMessage(
  message: AgentMessage,
): message is AgentMessage & { role: "user" | "assistant" } {
  return (
    (message.role === "user" || message.role === "assistant") &&
    message.status !== "streaming" &&
    message.status !== "aborted" &&
    message.status !== "error" &&
    message.content.trim().length > 0
  )
}
