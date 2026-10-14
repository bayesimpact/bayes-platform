import type { OAuthGrantClient } from "./oauth-grants.models"

/**
 * Name to show for a client: its declared name, else the host of a metadata document
 * client id (an https URL), else null so the caller shows a generic label.
 */
export function oauthGrantClientLabel(client: OAuthGrantClient): string | null {
  if (client.name) return client.name
  try {
    const url = new URL(client.clientId)
    return url.protocol === "https:" ? url.host : null
  } catch {
    return null
  }
}
