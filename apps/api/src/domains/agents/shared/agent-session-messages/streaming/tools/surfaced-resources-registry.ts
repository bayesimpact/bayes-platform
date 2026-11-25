import type { ResourceDto } from "@bayes-platform/api-contracts"
import { buildResourceLink } from "@/domains/resource-libraries/resource-library-link.helper"

/**
 * Structural subset of ResourceLibrary — everything the registry needs,
 * without a cross-domain entity import (boundary rule).
 */
export type SurfaceableLibrary = {
  id: string
  organizationId: string
  projectId: string
  title: string
  resources: ResourceDto[]
}

/**
 * Per-request registry of the agent's surfaceable resources, keyed by short
 * aliases (r1, r2, ...) — the ONLY ids the model ever sees. Same rationale
 * as the retrieved-chunks registry (c1, c2...): real ids and links are
 * un-copyable by small models (a mangled character silently breaks the
 * card), and exposing them in the prompt lets a weak model RECITE the
 * referential into the user-visible text instead of calling the tool — a raw
 * internal link pasted in an answer, which the front then renders. With
 * aliases, a recitation leaks nothing renderable; the surfaceResources tool
 * resolves aliases server-side.
 *
 * Unlike chunks, resources are static for the whole request (they come from
 * the agent's libraries, not from a mid-turn retrieval): the registry is
 * fully populated at build time, and the SAME enumeration order feeds the
 * master prompt listing — aliases in the prompt and in the registry always
 * match because both derive from enumerateAgentResources.
 */

export type SurfacedResourceEntry = {
  alias: string
  library: SurfaceableLibrary
  resource: ResourceDto
  link: string
}

export type SurfacedResourcesRegistry = {
  /** Resolves a model-cited alias (case/whitespace tolerant). */
  get(alias: string): SurfacedResourceEntry | undefined
  /** All entries, in prompt order. */
  list(): SurfacedResourceEntry[]
}

/**
 * Stable enumeration of the agent's resources: library order, then resource
 * order. Both the prompt helper and the registry rely on it.
 */
export function enumerateAgentResources(libraries: SurfaceableLibrary[]): SurfacedResourceEntry[] {
  const entries: SurfacedResourceEntry[] = []
  for (const library of libraries) {
    for (const resource of library.resources ?? []) {
      entries.push({
        alias: `r${entries.length + 1}`,
        library,
        resource,
        link: buildResourceLink({
          resource,
          organizationId: library.organizationId,
          projectId: library.projectId,
          resourceLibraryId: library.id,
        }),
      })
    }
  }
  return entries
}

export function createSurfacedResourcesRegistry(
  libraries: SurfaceableLibrary[],
): SurfacedResourcesRegistry {
  const entries = enumerateAgentResources(libraries)
  const byAlias = new Map(entries.map((entry) => [entry.alias, entry]))
  return {
    get(alias) {
      return byAlias.get(alias.trim().toLowerCase())
    },
    list() {
      return entries
    },
  }
}
