import { tool } from "ai"
import { z } from "zod"
import type { ToolExecutionLog } from "./tool-execution-log"

const subAgentInputSchema = z.object({
  task: z.string().min(1).describe("The precise task or question to delegate to the sub-agent."),
  context: z
    .string()
    .default("")
    .describe("Relevant conversation context the sub-agent needs to answer accurately."),
})

export type SubAgentToolInput = z.infer<typeof subAgentInputSchema>

export function subAgentTool({
  description,
  execute,
  onExecute,
  toolName,
}: {
  description: string
  execute: (input: SubAgentToolInput) => Promise<string>
  onExecute: (toolExecution: ToolExecutionLog) => void
  toolName: string
}) {
  return tool({
    description,
    inputSchema: subAgentInputSchema,
    outputSchema: z.object({
      answer: z.string().describe("The sub-agent response."),
    }),
    execute: async (input) => {
      onExecute({ toolName, arguments: input })
      const answer = await execute(input)
      return { answer }
    },
  })
}
