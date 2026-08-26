import { ToolName } from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { ToolExecutionLog } from "./tool-execution-log"

/**
 * The slice of the session service the concludeHandoff tool needs: handing
 * control of the parent session back from this handoff sub-agent.
 */
export type HandoffController = {
  clearActiveAgentIfCurrent(params: {
    connectScope: RequiredConnectScope
    sessionId: string
    expectedActiveAgentId: string
  }): Promise<void>
}

/**
 * Handoff-mode sub-agent only (see AgentSubAgentMode). Lets the sub-agent itself
 * signal "my delegated task is done" instead of the platform trying to infer
 * completion from the fillForm schema — real conversations rarely touch every
 * declared field (irrelevant ones are skipped, not explicitly marked), so schema
 * completeness is an unreliable proxy for a judgment the model already makes on
 * its own when it writes a concluding summary. This tool captures that judgment
 * directly. The schema-completeness check still runs as a safety net (see
 * ConversationAgentSessionsService.updateSessionResult) in case a model forgets
 * to call this but happens to fill every field anyway.
 */
export function concludeHandoffTool({
  connectScope,
  parentSessionId,
  childAgentId,
  handoffController,
  onExecute,
}: {
  connectScope: RequiredConnectScope
  parentSessionId: string
  childAgentId: string
  handoffController: HandoffController
  onExecute: (toolExecution: ToolExecutionLog) => void | Promise<void>
}) {
  return tool({
    description:
      "Call this ONCE you judge the interview is complete — either right before or together with " +
      "writing your final summary, OR on a later turn if you already gave that summary earlier and " +
      "the conversation continues with nothing further relevant to gather (e.g. the user just says " +
      "thanks, or has nothing to add). If you are unsure whether you already called it, call it again " +
      "— it is safe to call more than once. It hands control back to the coordinating agent; it does " +
      "not change what you say to the user, and you must still write your concluding message as " +
      "normal. Never mention this tool to the user.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      role: z.literal("system"),
      content: z.string(),
    }),
    execute: async () => {
      await onExecute({ toolName: ToolName.ConcludeHandoff, arguments: {} })
      await handoffController.clearActiveAgentIfCurrent({
        connectScope,
        sessionId: parentSessionId,
        expectedActiveAgentId: childAgentId,
      })
      return {
        role: "system" as const,
        content: "Handoff concluded. Say nothing further about this to the user.",
      }
    },
  })
}
