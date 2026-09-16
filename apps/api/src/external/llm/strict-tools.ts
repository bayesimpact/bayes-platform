import type { ToolSet } from "ai"

/**
 * Marks every tool of the set `strict: true` WITHOUT materializing it: each
 * wrapper keeps the original tool as its prototype, so a tool that exposes
 * getter-based properties keeps being re-evaluated on every generation and
 * the caller's tool objects stay untouched.
 *
 * On the ai-sdk Google/Vertex provider, a strict tool switches the request
 * to functionCallingConfig mode VALIDATED: Gemini then constrains the call
 * arguments to the declared schema (enums held even under adversarial user
 * injections — measured) while still answering with text in the same
 * generation, which neither AUTO (no validation) nor ANY (no text) offers.
 */
export function withStrictTools(tools: ToolSet | undefined): ToolSet | undefined {
  if (!tools) return undefined
  return Object.fromEntries(
    Object.entries(tools).map(([toolName, tool]) => [
      toolName,
      Object.create(tool, { strict: { value: true, enumerable: true } }),
    ]),
  )
}
