import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OidcDiscoveryService } from "./oidc-discovery.service"

/** Standard claims (OpenID Connect Core 1.0, section 5.1) the platform reads. */
export type OidcUserInfo = {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
}

@Injectable()
export class OidcUserInfoService {
  constructor(private readonly oidcDiscoveryService: OidcDiscoveryService) {}

  /** Calls the provider's userinfo endpoint with the caller's access token. */
  async getUserInfo(accessToken: string): Promise<OidcUserInfo> {
    const { userinfo_endpoint: userInfoUrl } = await this.oidcDiscoveryService.getMetadata()
    const response = await fetch(userInfoUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch OIDC user info: ${response.status} ${errorText}`)
    }

    return (await response.json()) as OidcUserInfo
  }
}

/**
 * Some providers put the email in `name` when the user has no display name.
 * In that case keep the part before "@" so the UI shows something readable.
 */
export function normalizeOidcName(
  name: string | undefined,
  email: string | undefined,
): string | undefined {
  if (!name || !email) return name
  if (name === email) return email.split("@")[0]
  return name
}
