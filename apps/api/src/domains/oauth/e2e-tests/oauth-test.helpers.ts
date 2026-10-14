import { createHash, randomBytes } from "node:crypto"
import type { OAuthGrantablePermission } from "@caseai-connect/api-contracts"
import type { INestApplication } from "@nestjs/common"
import { getStorageToken, type ThrottlerStorageService } from "@nestjs/throttler"
import request from "supertest"
import type { App } from "supertest/types"

export const TEST_REDIRECT_URI = "http://127.0.0.1:4567/callback"

/**
 * The API's base URL. The OAuth URLs follow the request host, so every call
 * of a flow must reach the same host and port: the app listens on one port.
 */
type ApiBaseUrl = string

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url")
  return {
    codeVerifier,
    codeChallenge: createHash("sha256").update(codeVerifier).digest("base64url"),
  }
}

/** The in-memory rate limit counters outlive a test; each test starts from zero. */
export function resetRateLimits(app: INestApplication<App>): void {
  const storage = app.get<ThrottlerStorageService>(getStorageToken())
  storage.storage.clear()
  // The hits live in a second, private map: clearing only the records keeps them counted.
  ;(storage as unknown as { hitExpirations: Map<string, unknown> }).hitExpirations.clear()
}

export async function registerTestClient(
  baseUrl: ApiBaseUrl,
  redirectUri = TEST_REDIRECT_URI,
): Promise<string> {
  const response = await request(baseUrl)
    .post("/api/oauth/register")
    .send({ redirect_uris: [redirectUri], client_name: "Helpful Client" })
  expect(response.status).toBe(201)
  return response.body.client_id
}

export function buildAuthorizationRequest(params: {
  clientId: string
  codeChallenge: string
  redirectUri?: string
}) {
  return {
    response_type: "code",
    client_id: params.clientId,
    redirect_uri: params.redirectUri ?? TEST_REDIRECT_URI,
    state: "state-123",
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  }
}

/** Approves the consent as the signed-in test user and returns the code from the redirect. */
export async function approveConsent(
  baseUrl: ApiBaseUrl,
  params: {
    clientId: string
    codeChallenge: string
    projectIds: string[]
    permissions: OAuthGrantablePermission[]
  },
): Promise<string> {
  const response = await request(baseUrl)
    .post("/api/oauth/consent")
    .set("Authorization", "Bearer token")
    .send({
      payload: {
        ...buildAuthorizationRequest(params),
        projectIds: params.projectIds,
        permissions: params.permissions,
      },
    })
  expect(response.status).toBe(201)
  const code = new URL(response.body.data.redirectTo).searchParams.get("code")
  if (!code) throw new Error("No code in the redirect")
  return code
}

export function exchangeCode(
  baseUrl: ApiBaseUrl,
  params: { clientId: string; code: string; codeVerifier: string },
) {
  return request(baseUrl).post("/api/oauth/token").type("form").send({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: TEST_REDIRECT_URI,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  })
}

/** The whole flow: registration, consent, code exchange. */
export async function obtainTokens(
  baseUrl: ApiBaseUrl,
  params: { projectIds: string[]; permissions: OAuthGrantablePermission[] },
): Promise<{ clientId: string; accessToken: string; refreshToken: string }> {
  const clientId = await registerTestClient(baseUrl)
  const { codeVerifier, codeChallenge } = generatePkcePair()
  const code = await approveConsent(baseUrl, { clientId, codeChallenge, ...params })
  const response = await exchangeCode(baseUrl, { clientId, code, codeVerifier })
  expect(response.status).toBe(200)
  return {
    clientId,
    accessToken: response.body.access_token,
    refreshToken: response.body.refresh_token,
  }
}
