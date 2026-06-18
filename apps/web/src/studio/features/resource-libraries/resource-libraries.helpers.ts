import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import type { Resource, ResourceLibrary } from "./resource-libraries.models"
import { selectResourceLibrariesData } from "./resource-libraries.selectors"

export function useResourceLibraries(): { resourceLibraries: ResourceLibrary[] } {
  const resourceLibrariesData = useAppSelector(selectResourceLibrariesData)
  const resourceLibraries = ADS.isFulfilled(resourceLibrariesData)
    ? resourceLibrariesData.value
    : []
  return { resourceLibraries }
}

export function isValidHttpsUrl(value: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }
  return parsed.protocol === "https:"
}

export function getResourceLibraryTitleById(
  resourceLibraries: ResourceLibrary[],
  resourceLibraryId: string,
): string {
  return (
    resourceLibraries.find((library) => library.id === resourceLibraryId)?.title ??
    "Unknown library"
  )
}

/**
 * Computes the link shown for a resource, mirroring the API's `buildResourceLink`. Typed-URL
 * resources use their url directly; uploaded files use a relative path to the public download
 * endpoint, which `ResourceCard.resolveLink` absolutizes against the API base URL.
 *
 * For unsaved resources (no persisted library id) the file link can't resolve yet, so it returns
 * an empty string and the card simply renders without media.
 */
export function buildResourceLink({
  resource,
  organizationId,
  projectId,
  resourceLibraryId,
}: {
  resource: Resource
  organizationId: string
  projectId: string
  resourceLibraryId: string | null
}): string {
  if (resource.linkType === "url") {
    return resource.url ?? ""
  }
  if (!resourceLibraryId) return ""
  return `/organizations/${organizationId}/projects/${projectId}/resource-libraries/${resourceLibraryId}/resources/${resource.id}/file`
}
