import { ToolName } from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { ActiveAgentController } from "./active-agent-controller"
import type { ToolExecutionLog } from "./tool-execution-log"

/** The slice of ConversationFormsService the conclusion needs: closing the child's form. */
export type HandoffFormConcluder = {
  conclude(params: {
    connectScope: RequiredConnectScope
    sessionId: string
    agentId: string
  }): Promise<void>
}

/** The instruction line the master prompt shows for this tool. */
export function concludeHandoffInstruction(parentAgentName: string): string {
  return (
    `Call it once, when your part of the conversation is done: you have what you needed, or the user ` +
    `has nothing more to add. It hands the conversation back to "${parentAgentName}", which speaks ` +
    `next. Still write your closing message to the user as normal. Never mention this tool.`
  )
}

/**
 * Given to a sub-agent while it is the active agent of a session (handoff
 * mode). The sub-agent judges when its task is over; the platform does not
 * infer it from the form (fields that do not apply are never filled). Clears
 * the session's active agent, only if this sub-agent still holds it, and marks
 * its form in the conversation as concluded.
 */
export function concludeHandoffTool({
  connectScope,
  sessionId,
  childAgentId,
  activeAgentController,
  formConcluder,
  onExecute,
}: {
  connectScope: RequiredConnectScope
  sessionId: string
  childAgentId: string
  activeAgentController: ActiveAgentController
  formConcluder: HandoffFormConcluder
  onExecute: (toolExecution: ToolExecutionLog) => void | Promise<void>
}) {
  return tool({
    description:
      "Hand the conversation back to the agent that handed it to you, once your part is done. " +
      "Safe to call more than once.",
    inputSchema: z.object({}),
    outputSchema: z.object({ status: z.literal("concluded"), note: z.string() }),
    execute: async () => {
      await onExecute({ toolName: ToolName.ConcludeHandoff, arguments: {} })
      await activeAgentController.clearActiveAgentIfCurrent({
        connectScope,
        sessionId,
        expectedActiveAgentId: childAgentId,
      })
      await formConcluder.conclude({ connectScope, sessionId, agentId: childAgentId })
      return {
        status: "concluded" as const,
        note: "The conversation goes back to the agent that handed it to you. Write your closing message.",
      }
    },
  })
}
