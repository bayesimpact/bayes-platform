import { tool } from "ai"
import { z } from "zod"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSubAgent } from "@/domains/agents/sub-agents/agent-sub-agent.entity"
import type { ActiveAgentController } from "./active-agent-controller"
import type { ToolExecutionLog } from "./tool-execution-log"

/** The slice of ConversationFormsService the handoff tool reads: has the child already concluded here? */
export type HandoffFormReader = {
  findOne(params: {
    connectScope: RequiredConnectScope
    sessionId: string
    agentId: string
  }): Promise<{ status: string; state: Record<string, unknown> } | null>
}

/**
 * The parent-side rule appended to every handoff tool description. The link
 * description written in the Studio says WHEN to hand the conversation over;
 * this says what handing over means for the parent's own reply.
 */
export function handoffToolInstruction(childAgentName: string): string {
  return (
    `Hands the conversation over to "${childAgentName}": the user's next messages are answered by ` +
    `"${childAgentName}" directly, until it hands the conversation back. After calling this tool, ` +
    `write one short sentence to introduce the hand-over, then stop. Do not ask its questions yourself ` +
    `and do not answer on its behalf.`
  )
}

/**
 * "handoff" mode of a sub-agent link (see AgentSubAgentMode). Calling the tool
 * does not run the child: it records the child as the session's active agent
 * and returns a short status for the parent's transition sentence. The child's
 * first turn follows in the same response (see the handoff turn loop), and the
 * user's next messages go to the child until it calls concludeHandoff.
 *
 * A child whose form in this conversation is already concluded is not handed
 * the conversation again: one form per agent and per conversation, and a
 * concluded one is final. The tool says so and gives the collected state, so
 * the parent decides the next step from it.
 */
/** Shared by the handoff tools of one turn: the first hand-over wins. */
export type HandoffTurnState = { handedOffTo?: { agentId: string; agentName: string } }

export function handoffTool({
  subAgent,
  description,
  connectScope,
  sessionId,
  activeAgentController,
  formReader,
  turnState,
  onExecute,
}: {
  subAgent: AgentSubAgent
  description: string
  connectScope: RequiredConnectScope
  sessionId: string
  activeAgentController: ActiveAgentController
  formReader: HandoffFormReader
  turnState: HandoffTurnState
  onExecute: (toolExecution: ToolExecutionLog) => void | Promise<void>
}) {
  const childAgent: Agent = subAgent.childAgent
  return tool({
    description,
    inputSchema: z.object({
      reason: z
        .string()
        .optional()
        .describe("One sentence on why the conversation goes to this agent now (for the trace)."),
    }),
    outputSchema: z.object({
      status: z.enum(["handed_off", "already_concluded", "already_handed_off"]),
      note: z.string(),
      collectedState: z.record(z.string(), z.unknown()).optional(),
    }),
    execute: async (input) => {
      await onExecute({ toolName: subAgent.toolName, arguments: input })

      // One hand-over per turn: a model that keeps calling tools after the
      // first one would otherwise move the conversation to the last agent
      // called, not to the one it announced to the user.
      if (turnState.handedOffTo) {
        return {
          status: "already_handed_off" as const,
          note:
            `The conversation was already handed to "${turnState.handedOffTo.agentName}" in this ` +
            `turn; it speaks next. Do not call another hand-over now. Write your one sentence and stop.`,
        }
      }

      const form = await formReader.findOne({ connectScope, sessionId, agentId: childAgent.id })
      if (form?.status === "concluded") {
        return {
          status: "already_concluded" as const,
          note:
            `"${childAgent.name}" already concluded its part of this conversation and cannot take it ` +
            `over again. Use what it collected (below) to decide the next step; do not call this tool ` +
            `again for it.`,
          collectedState: form.state,
        }
      }

      await activeAgentController.setActiveAgent({
        connectScope,
        sessionId,
        activeAgentId: childAgent.id,
      })
      turnState.handedOffTo = { agentId: childAgent.id, agentName: childAgent.name }
      return {
        status: "handed_off" as const,
        note:
          `The conversation is now handled by "${childAgent.name}", which speaks next. Write one ` +
          `short sentence to introduce the hand-over and stop.`,
      }
    },
  })
}
