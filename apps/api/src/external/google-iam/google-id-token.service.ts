import { Injectable } from "@nestjs/common"
import { GoogleAuth, type IdTokenClient } from "google-auth-library"

/**
 * Mints Google ID tokens for calls to IAM-protected services (Cloud Run
 * invoker IAM). The audience must be the target service root URL, not a path.
 */
@Injectable()
export class GoogleIdTokenService {
  // Created on first use, never at construction: building a GoogleAuth looks
  // for credentials, which are absent locally and in tests.
  private googleAuth: GoogleAuth | undefined

  // Cached per audience: IdTokenClient reuses its minted ID token until expiry
  // (~1h), but only when requests go through getRequestHeaders on the same
  // client instance.
  private readonly idTokenClients = new Map<string, IdTokenClient>()

  /** Returns the `Authorization` header value: `Bearer <id token>`. */
  async getAuthorizationHeader(audience: string): Promise<string> {
    const idTokenClient = await this.getIdTokenClient(audience)
    const requestHeaders = await idTokenClient.getRequestHeaders()
    const authorization = requestHeaders.get("authorization")
    if (!authorization) {
      throw new Error(`could not obtain a Google ID token for audience ${audience}`)
    }
    return authorization
  }

  private async getIdTokenClient(audience: string): Promise<IdTokenClient> {
    const cachedClient = this.idTokenClients.get(audience)
    if (cachedClient) return cachedClient
    this.googleAuth ??= new GoogleAuth()
    const idTokenClient = await this.googleAuth.getIdTokenClient(audience)
    this.idTokenClients.set(audience, idTokenClient)
    return idTokenClient
  }
}
