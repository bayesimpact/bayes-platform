import type { ResourceDto } from "@caseai-connect/api-contracts"

/**
 * Computes the link surfaced for a resource. Typed-URL resources use their url directly; uploaded
 * files use a relative path to the public download endpoint, which the frontend absolutizes against
 * the API base URL it already knows.
 */
export function buildResourceLink({
  resource,
  organizationId,
  projectId,
  resourceLibraryId,
}: {
  resource: ResourceDto
  organizationId: string
  projectId: string
  resourceLibraryId: string
}): string {
  if (resource.linkType === "url") {
    return resource.url ?? ""
  }
  return `/organizations/${organizationId}/projects/${projectId}/resource-libraries/${resourceLibraryId}/resources/${resource.id}/file`
}
