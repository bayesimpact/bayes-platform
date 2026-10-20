import {
  OAUTH_GRANTABLE_PERMISSIONS,
  oauthAuthorizationRequestSchema,
} from "@caseai-connect/api-contracts"
import type { OAuthAuthorizationRequest, OAuthConsentProject } from "./oauth-consent.models"

/** Reads the authorization request from the page query string, null when it is malformed. */
export function parseOAuthAuthorizationRequest(search: string): OAuthAuthorizationRequest | null {
  const params = new URLSearchParams(search)
  const raw: Record<string, string> = {}
  for (const key of Object.keys(oauthAuthorizationRequestSchema.shape)) {
    const value = params.get(key)
    if (value !== null) raw[key] = value
  }
  const result = oauthAuthorizationRequestSchema.safeParse(raw)
  return result.success ? result.data : null
}

/**
 * Where to send the browser when the person denies access (RFC 6749 section 4.1.2.1).
 * Only call it once the API has validated the redirect URI.
 */
export function buildOAuthDeniedUrl({
  redirectUri,
  state,
}: {
  redirectUri: string
  state?: string
}): string {
  const url = new URL(redirectUri)
  url.searchParams.set("error", "access_denied")
  if (state) url.searchParams.set("state", state)
  return url.toString()
}

export type OAuthConsentOrganizationGroup = {
  organizationId: string
  organizationName: string
  projects: OAuthConsentProject[]
}

/** Keeps organization order from the project list, as the project picker does. */
export function groupConsentProjectsByOrganization(
  projects: OAuthConsentProject[],
): OAuthConsentOrganizationGroup[] {
  const groups = new Map<string, OAuthConsentOrganizationGroup>()
  for (const project of projects) {
    const group = groups.get(project.organizationId) ?? {
      organizationId: project.organizationId,
      organizationName: project.organizationName,
      projects: [],
    }
    group.projects.push(project)
    groups.set(project.organizationId, group)
  }
  return [...groups.values()]
}

/** Permissions at least one of the selected projects allows. */
export function availablePermissionsFor(
  projects: OAuthConsentProject[],
  projectIds: string[],
): Set<string> {
  const selected = new Set(projectIds)
  return new Set(
    projects
      .filter((project) => selected.has(project.id))
      .flatMap((project) => project.availablePermissions),
  )
}

/** Grantable permissions named in the client's space separated `scope`. */
export function permissionsFromScope(scope: string | undefined): string[] {
  if (!scope) return []
  const requested = new Set(scope.split(" ").filter(Boolean))
  return OAUTH_GRANTABLE_PERMISSIONS.filter((permission) => requested.has(permission))
}
