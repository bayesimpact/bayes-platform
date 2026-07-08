import { tool } from "ai"
import { z } from "zod"
import type { ToolExecutionLog } from "./tool-execution-log"

const inputSchema = z.object({
  task: z.string().min(1).describe("The precise task or question to delegate to the sub-agent."),
  context: z
    .string()
    .default("")
    .describe("Relevant conversation context the sub-agent needs to answer accurately."),
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
