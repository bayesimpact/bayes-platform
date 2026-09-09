import { type AgentSessionToolCallDto, ToolName } from "@caseai-connect/api-contracts"
import { ResourceCard, type ResourceCardData } from "./ResourceCard"

type SurfacedResource = ResourceCardData & { id: string }

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

export function findSurfaceResourcesTool(
  toolCalls: AgentSessionToolCallDto[] | undefined,
): AgentSessionToolCallDto | undefined {
  return toolCalls?.find((toolCall) => toolCall.name === ToolName.SurfaceResources)
}

export function hasSurfacedResources(toolCalls: AgentSessionToolCallDto[] | undefined): boolean {
  const toolCall = findSurfaceResourcesTool(toolCalls)
  return toolCall !== undefined && parseResources(toolCall.arguments).length > 0
}

export function SurfaceResourcesTool({ toolCall }: { toolCall: AgentSessionToolCallDto }) {
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
