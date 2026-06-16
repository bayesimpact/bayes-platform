import { ToolName } from "@caseai-connect/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import type { ToolExecutionLog } from "./tool-execution-log"

export function surfaceResourcesTool({
  onExecute,
}: {
  onExecute: (toolExecution: ToolExecutionLog) => void
}) {
  return tool({
    description:
      "Surface resources from the agent's resource libraries to the user. Call this whenever the user's request matches a resource by its title or description, passing the matching resources verbatim.",
    inputSchema: z.object({
      resources: z.array(
        z.object({
          id: z.string().describe("The id of the matching resource (copy verbatim)."),
          title: z.string().describe("The title of the resource (copy verbatim)."),
          description: z.string().describe("The description of the resource (copy verbatim)."),
          link: z.string().describe("The link of the resource (copy verbatim)."),
        }),
      ),
    }),
    outputSchema: z.object({
      role: z.literal("system"),
      content: z.string().describe("The content of the system message."),
    }),
    execute: async (input, _options) => {
      onExecute({ toolName: ToolName.SurfaceResources, arguments: input })
      return {
        role: "system",
        content:
          'Resources received and shown to the user as cards. Reply with only a single short introductory sentence (e.g. "Here is a relevant resource:"). Do NOT restate the resources\' titles, descriptions, or links.',
      }
    },
  })
}
