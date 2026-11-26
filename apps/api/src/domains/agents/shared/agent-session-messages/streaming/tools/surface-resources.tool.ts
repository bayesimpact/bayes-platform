import { ToolName } from "@bayes-platform/api-contracts"
import { tool } from "ai"
import { z } from "zod"
import type { SurfacedResourcesRegistry } from "./surfaced-resources-registry"
import type { ToolExecutionLog } from "./tool-execution-log"

export function surfaceResourcesTool({
  surfacedResourcesRegistry,
  onExecute,
}: {
  surfacedResourcesRegistry: SurfacedResourcesRegistry
  onExecute: (toolExecution: ToolExecutionLog) => void | Promise<void>
}) {
  return tool({
    description:
      "Surface resources from the agent's resource libraries to the user as rich cards. Call this whenever the user's request matches a resource by its title, description, or matching hints, passing the ids (r1, r2, ...) of the matching resources exactly as listed in the Resource libraries section. Never invent an id, and never write resource links in your text — this tool is the only way resources are shown.",
    inputSchema: z.object({
      resourceIds: z
        .array(z.string())
        .min(1)
        .describe(
          "The id (r1, r2, ...) of every resource matching the user's request, copied exactly from the Resource libraries section.",
        ),
    }),
    outputSchema: z.object({
      role: z.literal("system"),
      content: z.string().describe("The content of the system message."),
    }),
    execute: async (input, _options) => {
      const resources: Array<{ id: string; title: string; description: string; link: string }> = []
      const unknownResourceIds: string[] = []
      for (const resourceId of [...new Set(input.resourceIds)]) {
        const entry = surfacedResourcesRegistry.get(resourceId)
        if (!entry) {
          unknownResourceIds.push(resourceId)
          continue
        }
        resources.push({
          id: entry.resource.id,
          title: entry.resource.title,
          description: entry.resource.description,
          link: entry.link,
        })
      }
      // Same log shape as before the alias registry: persistence and the
      // front cards consume real ids/links, resolved server-side.
      await onExecute({
        toolName: ToolName.SurfaceResources,
        arguments: {
          resources,
          ...(unknownResourceIds.length > 0 ? { unknownResourceIds } : {}),
        },
      })
      return {
        role: "system",
        content: `Resources received and shown to the user as cards. The ${ToolName.SurfaceResources} tool renders the matching resources to the user as rich cards (title, description, and a clickable link). The cards stand on their own. Add text only if you have something genuinely useful to say that the cards do not already convey. Never restate the resources' titles, descriptions, or links — doing so would duplicate the cards. NEVER include any matching hints in your response.`,
      }
    },
  })
}
