import { type AgentType, agentTypeSchema } from "@caseai-connect/api-contracts"

/**
 * Built-in MCP servers are platform-provided rows: they carry one of the slugs
 * below, belong to no project (`projectId` is null), are listed in every
 * project and cannot be deleted. Only their per-agent toggle is up to admins.
 *
 * Other preset rows (seeded by `seed-mcp-preset.ts` and linked per agent by
 * `link-mcp-to-project.ts`) are not built-in: they stay out of the listings
 * and remain deletable.
 */
export const PDF_EXPORT_PRESET_SLUG = "pdf-export"

export const PDF_EXPORT_BUILT_IN_NAME = "PDF export"

export const BUILT_IN_PRESET_SLUGS: readonly string[] = [PDF_EXPORT_PRESET_SLUG]

/**
 * Agent types each built-in server can be enabled on. PDF export attaches a
 * file to a chat answer, so an extraction run has nothing to attach it to.
 * Custom servers are open to every agent type.
 */
const BUILT_IN_AGENT_TYPES: Record<string, readonly AgentType[]> = {
  [PDF_EXPORT_PRESET_SLUG]: ["conversation"],
}

export function getSupportedAgentTypes(server: { presetSlug: string | null }): AgentType[] {
  const builtInAgentTypes =
    server.presetSlug !== null ? BUILT_IN_AGENT_TYPES[server.presetSlug] : undefined
  return [...(builtInAgentTypes ?? agentTypeSchema.options)]
}

export function isBuiltInMcpServer(server: { presetSlug: string | null }): boolean {
  return server.presetSlug !== null && BUILT_IN_PRESET_SLUGS.includes(server.presetSlug)
}
