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

export function isBuiltInMcpServer(server: { presetSlug: string | null }): boolean {
  return server.presetSlug !== null && BUILT_IN_PRESET_SLUGS.includes(server.presetSlug)
}
