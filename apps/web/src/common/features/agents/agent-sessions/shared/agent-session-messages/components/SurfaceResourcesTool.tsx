import type { AgentSessionToolName } from "@caseai-connect/api-contracts"
import { ResourceCard } from "@/common/components/resources/ResourceCard"

type SurfacedResource = {
  id: string
  title: string
  description: string
  link: string
}

type ToolCall = {
  id: string
  name: AgentSessionToolName
  arguments: Record<string, unknown>
}

function isSurfacedResource(value: unknown): value is SurfacedResource {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.link === "string"
  )
}

function parseResources(args: Record<string, unknown>): SurfacedResource[] {
  const resources = args.resources
  if (!Array.isArray(resources)) return []
  return resources.filter(isSurfacedResource)
}

export function SurfaceResourcesTool({ toolCall }: { toolCall: ToolCall }) {
  const resources = parseResources(toolCall.arguments)
  if (resources.length === 0) return null

  return (
    <div className="mt-2 flex w-full flex-col gap-3">
      {resources.map((resource) => (
        <ResourceCard key={resource.id} resource={resource} />
      ))}
    </div>
  )
}
