import { Injectable } from "@nestjs/common"
import { buildDiscoveryUrl, getOidcIssuerUrl } from "./oidc-config"

/** The subset of the OpenID Provider Metadata the API relies on. */
export type OidcProviderMetadata = {
  issuer: string
  jwks_uri: string
  userinfo_endpoint: string
}

/**
 * Fetches the provider's discovery document once and keeps it for the life of
 * the process. A failed fetch is not cached, so the next request retries.
 */
@Injectable()
export class OidcDiscoveryService {
  private metadataPromise: Promise<OidcProviderMetadata> | null = null

  getMetadata(): Promise<OidcProviderMetadata> {
    if (!this.metadataPromise) {
      this.metadataPromise = this.fetchMetadata().catch((error: unknown) => {
        this.metadataPromise = null
        throw error
      })
    }
    return this.metadataPromise
  }

  private async fetchMetadata(): Promise<OidcProviderMetadata> {
    const discoveryUrl = buildDiscoveryUrl(getOidcIssuerUrl())
    const response = await fetch(discoveryUrl, { headers: { Accept: "application/json" } })
    if (!response.ok) {
      throw new Error(
        `Failed to fetch the OIDC discovery document at ${discoveryUrl}: ${response.status}`,
      )
    }
    const metadata = (await response.json()) as Partial<OidcProviderMetadata>
    if (!metadata.jwks_uri || !metadata.userinfo_endpoint || !metadata.issuer) {
      throw new Error(
        `The OIDC discovery document at ${discoveryUrl} lacks issuer, jwks_uri or userinfo_endpoint`,
      )
    }
    return {
      issuer: metadata.issuer,
      jwks_uri: metadata.jwks_uri,
      userinfo_endpoint: metadata.userinfo_endpoint,
    }
  }
}
