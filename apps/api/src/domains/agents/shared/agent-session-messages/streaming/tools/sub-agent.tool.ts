import { tool } from "ai"
import { z } from "zod"
import type { ToolExecutionLog } from "./tool-execution-log"

const inputSchema = z.object({
  task: z
    .string()
    .min(1)
    .describe(
      "The precise instruction the sub-agent must carry out — what it should do or produce right now. " +
        "The recent user/assistant conversation is attached automatically, so do not restate what was " +
        "already said; give the concrete objective (e.g. what to collect, decide, or answer).",
    ),
  context: z
    .string()
    .optional()
    .describe(
      "Optional extra background the task alone does not convey (earlier decisions, the " +
        "user's underlying goal). The recent user/assistant messages are attached " +
        "automatically, so do not restate them here.",
    ),
})
const outputSchema = z.object({
  answer: z.string().describe("The sub-agent response."),
})

export type SubAgentToolInput = z.infer<typeof inputSchema>

export function subAgentTool({
  description,
  execute,
  onExecute,
  toolName,
}: {
  description: string
  execute: (input: SubAgentToolInput) => Promise<Record<string, unknown>>
  onExecute: (toolExecution: ToolExecutionLog) => void
  toolName: string
}) {
  return tool({
    description,
    inputSchema,
    outputSchema,
    execute: async (input) => {
      onExecute({ toolName, arguments: input })
      return execute(input as SubAgentToolInput)
    },
  })
}
