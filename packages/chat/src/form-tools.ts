import { TOOL_NAMES } from "@caseai-connect/chat-contracts"

/** The tools that change a form of the conversation. */
const FORM_TOOLS: ReadonlySet<string> = new Set([TOOL_NAMES.fillForm, TOOL_NAMES.consolidateForm])

/** Whether a tool the agent calls fills in or consolidates a form of the conversation. */
export function isFormTool(toolName: string): boolean {
  return FORM_TOOLS.has(toolName)
}
