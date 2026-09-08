# MCP OAuth Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users connect MCP servers that authenticate via OAuth 2.1 (authorization code + PKCE + dynamic client registration, per the MCP Authorization spec) instead of a static API key.

**Architecture:** The API drives the whole OAuth flow (discovery, dynamic client registration, PKCE, token exchange, refresh) and stores everything in the existing encrypted config blob — no DB migration. The browser is only used for the authorization redirect: the frontend opens the authorization URL, the provider redirects back to a frontend callback route, which posts `code` + `state` to an authenticated API endpoint. At tool-call time, the access token slots into the existing `Authorization: Bearer` header path, refreshed on demand.

**Tech Stack:** NestJS, TypeORM, `node:crypto` (PKCE), global `fetch` (discovery/registration/token calls — no new dependency), Zod contracts, React + Redux + react-router.

**Spec:** The "Context and design decisions" section below (this feature was designed in conversation; no separate spec file).

## Context and design decisions

Verified against a real server (`https://mcp.coros.com/mcp`): an unauthenticated MCP request returns `401` with `WWW-Authenticate: Bearer resource_metadata="https://mcpeu.coros.com/.well-known/oauth-protected-resource/mcp"`. That metadata (RFC 9728) lists `authorization_servers` and the canonical `resource`. The authorization server metadata (RFC 8414) provides `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `code_challenge_methods_supported: ["S256"]`, grants `authorization_code` + `refresh_token`. Dynamic client registration (RFC 7591) works unauthenticated and returns a public client (`token_endpoint_auth_method: "none"`), so PKCE is mandatory. Per the MCP spec, the `resource` parameter (RFC 8707) must be sent on both the authorization and token requests.

Key decisions:

- **No migration.** New state lives in the encrypted config blob (`McpServerConfig`), which was designed for this.
- **Callback lands on the frontend**, not the API. The frontend route posts `code`/`state` to an authenticated, policy-checked endpoint. No unauthenticated API route, CSRF is covered by `state` + JWT auth.
- **Pending-authorization state (state, PKCE verifier)** is stored in the blob itself with a 10-minute TTL. No Redis, no new table.
- **Tokens are project-level**, like the rest of the MCP server config: whoever authorizes lends their provider account to the whole project. Accepted product trade-off for v1.
- **Refresh at connect time**, under a pessimistic row lock (refresh tokens may rotate; two workers must not race).
- **No new npm dependency**: PKCE is 6 lines of `node:crypto`, the HTTP calls use `fetch` (pattern already used by the Auth0 services).
- **Auth status surfaced to the UI** as one field on `McpServerDto`: `"none" | "apiKey" | "oauthPending" | "oauthConnected"`.
- Also fixes an existing bug: `createOne` silently drops `payload.headers` (controller builds `config` without it).

User flow: create the server with just a URL → the server card shows an "Authorize" button → click calls `initiateOauth` (API does discovery + registration + PKCE, returns the authorization URL) → browser redirects to the provider → user consents → provider redirects to `/oauth/mcp/callback` on the frontend → callback posts `code`/`state` to `completeOauth` → API exchanges the code for tokens → card shows "Connected".

## Global Constraints

- No new npm dependencies (use `node:crypto` and global `fetch`).
- Never run `npm install`; a fresh worktree gets `npm ci`.
- No single-letter loop variables; never `any` / `@ts-ignore`.
- API gates (from repo root unless stated): `npm run biome:check`, `npm run typecheck`; full API suite via `cd apps/api && npm run test:parallel`; single spec via `npx jest --colors --runInBand --forceExit <path>` from `apps/api`.
- Web gates: `npm run biome:check`, `npm run typecheck`.
- `biome:check` is root-only and rewrites files — run it before committing each task.
- Commit messages: semantic (`feat: ...`, `fix: ...`), ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- New env var `MCP_OAUTH_REDIRECT_URL` (full frontend callback URL); documented in `apps/api/.env-example`.
- All user-facing strings in both `en` and `fr` locale files.
- CHANGELOG entries: one sentence, max 20 words, end-user capability wording.

---

### Task 1: Contracts — auth status + OAuth routes

**Files:**
- Modify: `packages/api-contracts/src/mcp-servers/mcp-servers.dto.ts`
- Modify: `packages/api-contracts/src/mcp-servers/mcp-servers.routes.ts`
- Modify: `apps/api/src/domains/mcp-servers/mcp-servers.service.ts` (config types + `getConfig` + `getAuthStatus`)
- Modify: `apps/api/src/domains/mcp-servers/mcp-servers.controller.ts` (DTO mapping)
- Modify: `apps/web/src/studio/features/mcp-servers/external/mcp-servers.api.ts` (mapper)
- Modify: `apps/web/src/studio/features/mcp-servers/mcp-servers.factory.ts`

**Interfaces:**
- Produces: `McpServerAuthStatus`, `McpServerDto.authStatus`, `completeMcpServerOauthSchema`, `CompleteMcpServerOauthDto`, `McpServerOauthInitiationDto`, routes `McpServersRoutes.initiateOauth` / `McpServersRoutes.completeOauth`; backend types `McpServerOauthState`, `McpServerOauthTokens`, `McpServerOauthPendingAuth`; service methods `getConfig(mcpServer: McpServer): McpServerConfig` and `getAuthStatus(config: McpServerConfig): McpServerAuthStatus`.

- [ ] **Step 1: Extend the DTO file**

In `packages/api-contracts/src/mcp-servers/mcp-servers.dto.ts`, add below the existing content (and add `authStatus: McpServerAuthStatus` to `McpServerDto`):

```typescript
export type McpServerAuthStatus = "none" | "apiKey" | "oauthPending" | "oauthConnected"

export type McpServerOauthInitiationDto = {
  authorizationUrl: string
}

export const completeMcpServerOauthSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
})

export type CompleteMcpServerOauthDto = z.infer<typeof completeMcpServerOauthSchema>
```

(`packages/api-contracts/src/index.ts` already does `export * from "./mcp-servers/mcp-servers.dto"` at line 71 — nothing to add there.)

- [ ] **Step 2: Add the two routes**

In `packages/api-contracts/src/mcp-servers/mcp-servers.routes.ts`, extend the import to include the new DTO types and add to `McpServersRoutes`:

```typescript
initiateOauth: defineRoute<ResponseData<McpServerOauthInitiationDto>>({
  method: "post",
  path: "organizations/:organizationId/projects/:projectId/mcp-servers/:mcpServerId/oauth/initiate",
}),
completeOauth: defineRoute<
  ResponseData<McpServerDto>,
  RequestPayload<CompleteMcpServerOauthDto>
>({
  method: "post",
  path: "organizations/:organizationId/projects/:projectId/mcp-servers/:mcpServerId/oauth/complete",
}),
```

- [ ] **Step 3: Add OAuth state types + auth status to the backend service**

In `apps/api/src/domains/mcp-servers/mcp-servers.service.ts`:

Add after the `McpServerConfig` type (and add `oauth?: McpServerOauthState` as a new optional field on `McpServerConfig`):

```typescript
export type McpServerOauthTokens = {
  accessToken: string
  refreshToken?: string
  /** Epoch ms after which accessToken must be refreshed. */
  expiresAt: number
}

export type McpServerOauthPendingAuth = {
  state: string
  codeVerifier: string
  redirectUri: string
  /** Epoch ms; a pending authorization is single-use and short-lived. */
  expiresAt: number
}

/**
 * OAuth 2.1 state for servers using the MCP Authorization spec. Lives in the
 * encrypted config blob, so adding fields needs no migration.
 */
export type McpServerOauthState = {
  clientId: string
  authorizationEndpoint: string
  tokenEndpoint: string
  /** Canonical resource URI (RFC 8707), sent on authorize and token calls. */
  resource: string
  scope?: string
  tokens?: McpServerOauthTokens
  pendingAuth?: McpServerOauthPendingAuth
}
```

Then make the config readable by the controller and add the status derivation (keep the private `decryptConfig`; `getConfig` just exposes it):

```typescript
getConfig(mcpServer: McpServer): McpServerConfig {
  return this.decryptConfig(mcpServer)
}

getAuthStatus(config: McpServerConfig): McpServerAuthStatus {
  if (config.oauth?.tokens) return "oauthConnected"
  if (config.oauth) return "oauthPending"
  if (config.apiKey) return "apiKey"
  return "none"
}
```

(`McpServerAuthStatus` is imported as a type from `@caseai-connect/api-contracts`.)

- [ ] **Step 4: Map authStatus in the controller**

In `apps/api/src/domains/mcp-servers/mcp-servers.controller.ts`, change `toMcpServerDto` to take the config instead of the bare URL, and derive the status. Replace the function and its call sites:

```typescript
function toMcpServerDto(
  entity: McpServer,
  config: McpServerConfig,
  authStatus: McpServerAuthStatus,
): McpServerDto {
  return {
    id: entity.id,
    name: entity.name,
    url: config.url,
    projectId: entity.projectId!,
    authStatus,
    createdAt: entity.createdAt.getTime(),
    updatedAt: entity.updatedAt.getTime(),
  }
}
```

In `createOne`: build `const config = { url: payload.url, apiKey: payload.apiKey, headers: payload.headers }` (this also fixes the dropped-headers bug), pass it to `createMcpServer`, and return `toMcpServerDto(mcpServer, config, this.mcpServersService.getAuthStatus(config))`.

In `getAll`: for each server, `const config = this.mcpServersService.getConfig(server)` then `toMcpServerDto(server, config, this.mcpServersService.getAuthStatus(config))`. Import `McpServerAuthStatus` (type) from the contracts and `McpServerConfig` (type) from the service.

- [ ] **Step 5: Propagate to the web mapper and factory**

`apps/web/src/studio/features/mcp-servers/external/mcp-servers.api.ts` — add `authStatus: dto.authStatus` to `toMcpServer`.

`apps/web/src/studio/features/mcp-servers/mcp-servers.factory.ts` — add `authStatus: params.authStatus ?? "none"` to the returned object.

- [ ] **Step 6: Update the existing e2e assertion for the headers fix**

In `apps/api/src/domains/mcp-servers/e2e-tests/create-one.spec.ts`, extend the happy-path test: post `payload: { name: "Knowledge Base", url: "https://mcp.example.com", headers: { "X-Api-Version": "2" } }`, then assert `response.body.data.authStatus` is `"none"` and that the stored config kept the headers. Decrypt via the module's service:

```typescript
const mcpServersService = setup.module.get(McpServersService)
const config = mcpServersService.getConfig(stored!)
expect(config.headers).toEqual({ "X-Api-Version": "2" })
```

(Import `McpServersService` from `../mcp-servers.service`.)

- [ ] **Step 7: Run the touched specs**

From `apps/api`: `npx jest --colors --runInBand --forceExit src/domains/mcp-servers/e2e-tests/create-one.spec.ts src/domains/mcp-servers/e2e-tests/list.spec.ts`
Expected: PASS.

- [ ] **Step 8: Gates and commit**

Run from root: `npm run biome:check`, `npm run typecheck`. Expected: exit 0.

```bash
git add packages/api-contracts apps/api/src/domains/mcp-servers apps/web/src/studio/features/mcp-servers
git commit -m "feat(mcp): expose auth status on MCP servers and define OAuth routes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: PKCE helpers

**Files:**
- Create: `apps/api/src/domains/mcp-servers/oauth/pkce.ts`
- Test: `apps/api/src/domains/mcp-servers/oauth/pkce.spec.ts`

**Interfaces:**
- Produces: `generateCodeVerifier(): string`, `codeChallengeS256(codeVerifier: string): string`, `generateState(): string`.

- [ ] **Step 1: Write the failing test**

```typescript
import { createHash } from "node:crypto"
import { codeChallengeS256, generateCodeVerifier, generateState } from "./pkce"

describe("pkce", () => {
  it("generates a code verifier of valid RFC 7636 length and charset", () => {
    const verifier = generateCodeVerifier()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  it("generates unique verifiers and states", () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier())
    expect(generateState()).not.toBe(generateState())
  })

  it("computes the S256 challenge as base64url(sha256(verifier))", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    const expected = createHash("sha256").update(verifier).digest("base64url")
    expect(codeChallengeS256(verifier)).toBe(expected)
    expect(codeChallengeS256(verifier)).not.toContain("=")
  })
})
```

- [ ] **Step 2: Run it — expect FAIL (module not found)**

From `apps/api`: `npx jest --colors --runInBand --forceExit src/domains/mcp-servers/oauth/pkce.spec.ts`

- [ ] **Step 3: Implement**

```typescript
import { createHash, randomBytes } from "node:crypto"

/** RFC 7636 code verifier: 32 random bytes → 43 base64url chars. */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url")
}

/** RFC 7636 S256 challenge: base64url(sha256(verifier)), no padding. */
export function codeChallengeS256(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url")
}

/** Opaque anti-CSRF value for the authorization request. */
export function generateState(): string {
  return randomBytes(24).toString("base64url")
}
```

- [ ] **Step 4: Run the spec — expect PASS**

- [ ] **Step 5: Gates and commit**

`npm run biome:check`, `npm run typecheck` from root.

```bash
git add apps/api/src/domains/mcp-servers/oauth
git commit -m "feat(mcp): add PKCE helpers for MCP OAuth

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: OAuth discovery and dynamic client registration client

**Files:**
- Create: `apps/api/src/domains/mcp-servers/oauth/mcp-oauth-discovery.ts`
- Test: `apps/api/src/domains/mcp-servers/oauth/mcp-oauth-discovery.spec.ts`

**Interfaces:**
- Produces:
  - `type McpOauthDiscovery = { authorizationEndpoint: string; tokenEndpoint: string; registrationEndpoint?: string; resource: string; scopesSupported?: string[] }`
  - `discoverOauthConfiguration(mcpUrl: string): Promise<McpOauthDiscovery | null>` — `null` means "this server does not advertise OAuth".
  - `registerOauthClient(params: { registrationEndpoint: string; redirectUri: string }): Promise<string>` — returns the `client_id`.

- [ ] **Step 1: Write the failing tests**

Mock `fetch` globally like `apps/api/src/domains/auth/auth0-invitation-sender.service.spec.ts:7` does (`global.fetch = jest.fn()`), and answer with real `Response` objects:

```typescript
import { discoverOauthConfiguration, registerOauthClient } from "./mcp-oauth-discovery"

global.fetch = jest.fn()
const fetchMock = global.fetch as jest.Mock

const MCP_URL = "https://mcp.example.com/mcp"

const resourceMetadata = {
  resource: "https://mcp.example.com",
  authorization_servers: ["https://auth.example.com"],
  scopes_supported: ["mcp.tools", "offline_access"],
}

const authServerMetadata = {
  issuer: "https://auth.example.com",
  authorization_endpoint: "https://auth.example.com/oauth2/authorize",
  token_endpoint: "https://auth.example.com/oauth2/token",
  registration_endpoint: "https://auth.example.com/connect/register",
  code_challenge_methods_supported: ["S256"],
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })

describe("discoverOauthConfiguration", () => {
  beforeEach(() => fetchMock.mockReset())

  it("follows WWW-Authenticate resource_metadata from a 401 probe", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 401,
          headers: {
            "WWW-Authenticate":
              'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp"',
          },
        }),
      )
      .mockResolvedValueOnce(json(resourceMetadata))
      .mockResolvedValueOnce(json(authServerMetadata))

    const discovery = await discoverOauthConfiguration(MCP_URL)

    expect(discovery).toEqual({
      authorizationEndpoint: "https://auth.example.com/oauth2/authorize",
      tokenEndpoint: "https://auth.example.com/oauth2/token",
      registrationEndpoint: "https://auth.example.com/connect/register",
      resource: "https://mcp.example.com",
      scopesSupported: ["mcp.tools", "offline_access"],
    })
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
    )
  })

  it("falls back to the path-derived well-known URL when the probe has no WWW-Authenticate", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(resourceMetadata))
      .mockResolvedValueOnce(json(authServerMetadata))

    const discovery = await discoverOauthConfiguration(MCP_URL)

    expect(discovery?.tokenEndpoint).toBe("https://auth.example.com/oauth2/token")
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
    )
  })

  it("returns null when the server advertises no OAuth metadata", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))

    expect(await discoverOauthConfiguration(MCP_URL)).toBeNull()
  })

  it("tries openid-configuration when oauth-authorization-server metadata is missing", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json(resourceMetadata))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(json(authServerMetadata))

    const discovery = await discoverOauthConfiguration(MCP_URL)

    expect(discovery?.authorizationEndpoint).toBe("https://auth.example.com/oauth2/authorize")
    expect(fetchMock.mock.calls[3][0]).toBe(
      "https://auth.example.com/.well-known/openid-configuration",
    )
  })
})

describe("registerOauthClient", () => {
  beforeEach(() => fetchMock.mockReset())

  it("registers a public client and returns its client_id", async () => {
    fetchMock.mockResolvedValueOnce(json({ client_id: "client-123" }))

    const clientId = await registerOauthClient({
      registrationEndpoint: "https://auth.example.com/connect/register",
      redirectUri: "https://app.example.com/oauth/mcp/callback",
    })

    expect(clientId).toBe("client-123")
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://auth.example.com/connect/register")
    expect(JSON.parse(init.body)).toMatchObject({
      redirect_uris: ["https://app.example.com/oauth/mcp/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    })
  })

  it("throws when registration fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 400 }))

    await expect(
      registerOauthClient({
        registrationEndpoint: "https://auth.example.com/connect/register",
        redirectUri: "https://app.example.com/oauth/mcp/callback",
      }),
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run — expect FAIL (module not found)**

From `apps/api`: `npx jest --colors --runInBand --forceExit src/domains/mcp-servers/oauth/mcp-oauth-discovery.spec.ts`

- [ ] **Step 3: Implement**

```typescript
/**
 * OAuth discovery for MCP servers, per the MCP Authorization spec:
 * RFC 9728 (protected resource metadata), RFC 8414 (authorization server
 * metadata) and RFC 7591 (dynamic client registration). Pure functions over
 * global fetch so they can be unit-tested without Nest.
 */

export type McpOauthDiscovery = {
  authorizationEndpoint: string
  tokenEndpoint: string
  registrationEndpoint?: string
  /** Canonical resource URI (RFC 8707), from the protected resource metadata. */
  resource: string
  scopesSupported?: string[]
}

type ProtectedResourceMetadata = {
  resource?: string
  authorization_servers?: string[]
  scopes_supported?: string[]
}

type AuthorizationServerMetadata = {
  authorization_endpoint?: string
  token_endpoint?: string
  registration_endpoint?: string
}

export async function discoverOauthConfiguration(mcpUrl: string): Promise<McpOauthDiscovery | null> {
  const resourceMetadataUrl = await probeForResourceMetadataUrl(mcpUrl)
  const resourceMetadata = await fetchJson<ProtectedResourceMetadata>(resourceMetadataUrl)
  if (!resourceMetadata?.authorization_servers?.length) return null

  const issuer = resourceMetadata.authorization_servers[0].replace(/\/$/, "")
  const serverMetadata =
    (await fetchJson<AuthorizationServerMetadata>(
      `${issuer}/.well-known/oauth-authorization-server`,
    )) ?? (await fetchJson<AuthorizationServerMetadata>(`${issuer}/.well-known/openid-configuration`))
  if (!serverMetadata?.authorization_endpoint || !serverMetadata.token_endpoint) return null

  return {
    authorizationEndpoint: serverMetadata.authorization_endpoint,
    tokenEndpoint: serverMetadata.token_endpoint,
    registrationEndpoint: serverMetadata.registration_endpoint,
    resource: resourceMetadata.resource ?? mcpUrl,
    scopesSupported: resourceMetadata.scopes_supported,
  }
}

export async function registerOauthClient({
  registrationEndpoint,
  redirectUri,
}: {
  registrationEndpoint: string
  redirectUri: string
}): Promise<string> {
  const response = await fetch(registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Bayes Platform",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  })
  if (!response.ok) {
    throw new Error(`Dynamic client registration failed with status ${response.status}`)
  }
  const body = (await response.json()) as { client_id?: string }
  if (!body.client_id) throw new Error("Dynamic client registration returned no client_id")
  return body.client_id
}

/**
 * Probes the MCP endpoint expecting a 401 whose WWW-Authenticate names the
 * resource metadata URL. Falls back to the RFC 9728 path-derived well-known
 * URL when the header is absent or the probe itself fails.
 */
async function probeForResourceMetadataUrl(mcpUrl: string): Promise<string> {
  try {
    const probe = await fetch(mcpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 0, method: "ping" }),
    })
    const wwwAuthenticate = probe.headers.get("www-authenticate")
    const match = wwwAuthenticate?.match(/resource_metadata="([^"]+)"/)
    if (match) return match[1]
  } catch {
    // Network errors fall through to the well-known fallback.
  }
  const url = new URL(mcpUrl)
  const path = url.pathname === "/" ? "" : url.pathname
  return `${url.origin}/.well-known/oauth-protected-resource${path}`
}

async function fetchJson<ResponseBody>(url: string): Promise<ResponseBody | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return (await response.json()) as ResponseBody
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run the spec — expect PASS**

- [ ] **Step 5: Gates and commit**

`npm run biome:check`, `npm run typecheck`.

```bash
git add apps/api/src/domains/mcp-servers/oauth
git commit -m "feat(mcp): add OAuth discovery and dynamic client registration client

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: McpOauthService — initiate authorization

**Files:**
- Create: `apps/api/src/domains/mcp-servers/oauth/mcp-oauth.service.ts`
- Test: `apps/api/src/domains/mcp-servers/oauth/mcp-oauth.service.spec.ts`
- Modify: `apps/api/src/domains/mcp-servers/mcp-servers.module.ts` (provider + export)
- Modify: `apps/api/.env-example` (add `MCP_OAUTH_REDIRECT_URL`)

**Interfaces:**
- Consumes: `discoverOauthConfiguration`, `registerOauthClient` (Task 3), `generateCodeVerifier`/`codeChallengeS256`/`generateState` (Task 2), `McpServerOauthState` (Task 1), `EncryptionService`.
- Produces: `McpOauthService.initiateAuthorization(mcpServer: McpServer): Promise<{ authorizationUrl: string }>`, plus private `readConfig`/`saveConfig` reused by Tasks 5–6. Env: `MCP_OAUTH_REDIRECT_URL`.

- [ ] **Step 1: Write the failing spec**

Use `setupTransactionalTestDatabase` (pattern of other `*.service.spec.ts` in the domain — see `apps/api/src/domains/mcp-servers/`; if none exists in this folder, follow the structure from the e2e spec's DB setup with `Test.createTestingModule` importing `McpServersModule` overridden the same way). Mock `global.fetch` as in Task 3. Set `process.env.MCP_OAUTH_REDIRECT_URL = "https://app.test/oauth/mcp/callback"` at the top of the spec, before the module compiles.

Test cases:

```typescript
it("stores oauth state and returns the authorization URL with PKCE, state, resource and scope", async () => {
  // fetch mocks: 401 probe with WWW-Authenticate → resource metadata → AS metadata → registration
  // (reuse the fixtures from mcp-oauth-discovery.spec.ts, plus json({ client_id: "client-123" }))
  const mcpServer = await createServer({ url: "https://mcp.example.com/mcp" }) // helper: mcpServersService.createMcpServer

  const { authorizationUrl } = await mcpOauthService.initiateAuthorization(mcpServer)

  const url = new URL(authorizationUrl)
  expect(url.origin + url.pathname).toBe("https://auth.example.com/oauth2/authorize")
  expect(url.searchParams.get("response_type")).toBe("code")
  expect(url.searchParams.get("client_id")).toBe("client-123")
  expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/oauth/mcp/callback")
  expect(url.searchParams.get("code_challenge_method")).toBe("S256")
  expect(url.searchParams.get("code_challenge")).toBeTruthy()
  expect(url.searchParams.get("state")).toBeTruthy()
  expect(url.searchParams.get("resource")).toBe("https://mcp.example.com")
  expect(url.searchParams.get("scope")).toBe("mcp.tools offline_access")

  const reloaded = await mcpServerRepository.findOneByOrFail({ id: mcpServer.id })
  const config = mcpServersService.getConfig(reloaded)
  expect(config.oauth?.clientId).toBe("client-123")
  expect(config.oauth?.pendingAuth?.state).toBe(url.searchParams.get("state"))
  expect(config.oauth?.pendingAuth?.codeVerifier).toBeTruthy()
  expect(config.oauth?.pendingAuth?.expiresAt).toBeGreaterThan(Date.now())
})

it("reuses the already-registered client on a second initiation", async () => {
  // run initiateAuthorization twice with fresh discovery mocks each time but
  // only ONE registration mock; assert fetch was never called on the
  // registration endpoint the second time and clientId is unchanged.
})

it("throws BadRequestException when the server advertises no OAuth metadata", async () => {
  // discovery mocks all return 404 → expect rejects.toThrow(BadRequestException)
})

it("throws BadRequestException when there is no registration endpoint and no stored client", async () => {
  // AS metadata without registration_endpoint → expect BadRequestException
})
```

- [ ] **Step 2: Run — expect FAIL (module not found)**

From `apps/api`: `npx jest --colors --runInBand --forceExit src/domains/mcp-servers/oauth/mcp-oauth.service.spec.ts`

- [ ] **Step 3: Implement the service**

```typescript
import { BadRequestException, Injectable, Logger } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ConfigService } from "@nestjs/config"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EncryptionService } from "../encryption.service"
import { McpServer } from "../mcp-server.entity"
import type { McpServerConfig, McpServerOauthState } from "../mcp-servers.service"
import { discoverOauthConfiguration, registerOauthClient } from "./mcp-oauth-discovery"
import { codeChallengeS256, generateCodeVerifier, generateState } from "./pkce"

const PENDING_AUTH_TTL_MS = 10 * 60 * 1000

@Injectable()
export class McpOauthService {
  private readonly logger = new Logger(McpOauthService.name)

  constructor(
    @InjectRepository(McpServer)
    private readonly mcpServerRepository: Repository<McpServer>,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {}

  async initiateAuthorization(mcpServer: McpServer): Promise<{ authorizationUrl: string }> {
    const config = this.readConfig(mcpServer)
    const redirectUri = this.configService.getOrThrow<string>("MCP_OAUTH_REDIRECT_URL")

    const discovery = await discoverOauthConfiguration(config.url)
    if (!discovery) {
      throw new BadRequestException(
        "This MCP server does not advertise OAuth authorization. Use an API key instead.",
      )
    }

    let clientId = config.oauth?.clientId
    if (!clientId) {
      if (!discovery.registrationEndpoint) {
        throw new BadRequestException(
          "This MCP server's authorization server does not support dynamic client registration.",
        )
      }
      clientId = await registerOauthClient({
        registrationEndpoint: discovery.registrationEndpoint,
        redirectUri,
      })
    }

    const codeVerifier = generateCodeVerifier()
    const state = generateState()
    const scope = discovery.scopesSupported?.join(" ")

    const oauth: McpServerOauthState = {
      clientId,
      authorizationEndpoint: discovery.authorizationEndpoint,
      tokenEndpoint: discovery.tokenEndpoint,
      resource: discovery.resource,
      scope,
      tokens: config.oauth?.tokens,
      pendingAuth: {
        state,
        codeVerifier,
        redirectUri,
        expiresAt: Date.now() + PENDING_AUTH_TTL_MS,
      },
    }
    await this.saveConfig(mcpServer.id, { ...config, oauth })

    const authorizationUrl = new URL(discovery.authorizationEndpoint)
    authorizationUrl.searchParams.set("response_type", "code")
    authorizationUrl.searchParams.set("client_id", clientId)
    authorizationUrl.searchParams.set("redirect_uri", redirectUri)
    authorizationUrl.searchParams.set("state", state)
    authorizationUrl.searchParams.set("code_challenge", codeChallengeS256(codeVerifier))
    authorizationUrl.searchParams.set("code_challenge_method", "S256")
    authorizationUrl.searchParams.set("resource", discovery.resource)
    if (scope) authorizationUrl.searchParams.set("scope", scope)

    return { authorizationUrl: authorizationUrl.toString() }
  }

  private readConfig(mcpServer: McpServer): McpServerConfig {
    return JSON.parse(this.encryptionService.decrypt(mcpServer.encryptedConfig)) as McpServerConfig
  }

  private async saveConfig(mcpServerId: string, config: McpServerConfig): Promise<void> {
    await this.mcpServerRepository.update(
      { id: mcpServerId },
      { encryptedConfig: this.encryptionService.encrypt(JSON.stringify(config)) },
    )
  }
}
```

- [ ] **Step 4: Register in the module**

In `apps/api/src/domains/mcp-servers/mcp-servers.module.ts`: add `McpOauthService` to `providers` and `exports`.

- [ ] **Step 5: Document the env var**

In `apps/api/.env-example`, next to `MCP_ENCRYPTION_KEY` (line ~87):

```
# Frontend callback URL registered with MCP OAuth providers
MCP_OAUTH_REDIRECT_URL=https://connect.localhost:5173/oauth/mcp/callback
```

- [ ] **Step 6: Run the spec — expect PASS**

- [ ] **Step 7: Gates and commit**

`npm run biome:check`, `npm run typecheck`.

```bash
git add apps/api/src/domains/mcp-servers apps/api/.env-example
git commit -m "feat(mcp): initiate OAuth authorization with discovery, DCR and PKCE

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: McpOauthService — complete authorization (code exchange)

**Files:**
- Modify: `apps/api/src/domains/mcp-servers/oauth/mcp-oauth.service.ts`
- Test: `apps/api/src/domains/mcp-servers/oauth/mcp-oauth.service.spec.ts`

**Interfaces:**
- Produces: `McpOauthService.completeAuthorization(params: { mcpServer: McpServer; code: string; state: string }): Promise<McpServer>` (returns the reloaded entity).

- [ ] **Step 1: Write the failing tests**

Add to the spec (helper `initiateForServer()` runs Task 4's flow with mocks and returns the reloaded entity + parsed state):

```typescript
it("exchanges the code with the PKCE verifier and stores the tokens", async () => {
  const { mcpServer, state, codeVerifier } = await initiateForServer()
  fetchMock.mockResolvedValueOnce(
    json({ access_token: "at-1", refresh_token: "rt-1", expires_in: 3600, token_type: "Bearer" }),
  )

  const updated = await mcpOauthService.completeAuthorization({ mcpServer, code: "code-1", state })

  const [tokenUrl, init] = fetchMock.mock.calls.at(-1)!
  expect(tokenUrl).toBe("https://auth.example.com/oauth2/token")
  const body = new URLSearchParams(init.body)
  expect(body.get("grant_type")).toBe("authorization_code")
  expect(body.get("code")).toBe("code-1")
  expect(body.get("code_verifier")).toBe(codeVerifier)
  expect(body.get("client_id")).toBe("client-123")
  expect(body.get("redirect_uri")).toBe("https://app.test/oauth/mcp/callback")
  expect(body.get("resource")).toBe("https://mcp.example.com")

  const config = mcpServersService.getConfig(updated)
  expect(config.oauth?.tokens?.accessToken).toBe("at-1")
  expect(config.oauth?.tokens?.refreshToken).toBe("rt-1")
  expect(config.oauth?.tokens?.expiresAt).toBeGreaterThan(Date.now())
  expect(config.oauth?.pendingAuth).toBeUndefined()
})

it("rejects a mismatched state", async () => {
  const { mcpServer } = await initiateForServer()
  await expect(
    mcpOauthService.completeAuthorization({ mcpServer, code: "code-1", state: "wrong" }),
  ).rejects.toThrow(BadRequestException)
})

it("rejects an expired pending authorization", async () => {
  // initiate, then rewrite the stored config with pendingAuth.expiresAt = Date.now() - 1000
  // expect BadRequestException
})

it("rejects when there is no pending authorization", async () => {
  const mcpServer = await createServer({ url: "https://mcp.example.com/mcp" })
  await expect(
    mcpOauthService.completeAuthorization({ mcpServer, code: "c", state: "s" }),
  ).rejects.toThrow(BadRequestException)
})

it("surfaces a token endpoint error as BadRequestException", async () => {
  const { mcpServer, state } = await initiateForServer()
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }))
  await expect(
    mcpOauthService.completeAuthorization({ mcpServer, code: "bad", state }),
  ).rejects.toThrow(BadRequestException)
})
```

- [ ] **Step 2: Run — expect FAIL (method missing)**

- [ ] **Step 3: Implement**

Add to `McpOauthService`:

```typescript
async completeAuthorization({
  mcpServer,
  code,
  state,
}: {
  mcpServer: McpServer
  code: string
  state: string
}): Promise<McpServer> {
  const config = this.readConfig(mcpServer)
  const pendingAuth = config.oauth?.pendingAuth
  if (!config.oauth || !pendingAuth) {
    throw new BadRequestException("No pending OAuth authorization for this MCP server.")
  }
  if (pendingAuth.state !== state) {
    throw new BadRequestException("OAuth state mismatch.")
  }
  if (pendingAuth.expiresAt < Date.now()) {
    throw new BadRequestException("The OAuth authorization expired. Start again.")
  }

  const tokens = await this.requestTokens(config.oauth.tokenEndpoint, {
    grant_type: "authorization_code",
    code,
    redirect_uri: pendingAuth.redirectUri,
    client_id: config.oauth.clientId,
    code_verifier: pendingAuth.codeVerifier,
    resource: config.oauth.resource,
  })

  const { pendingAuth: _discarded, ...oauthRest } = config.oauth
  await this.saveConfig(mcpServer.id, { ...config, oauth: { ...oauthRest, tokens } })
  return this.mcpServerRepository.findOneByOrFail({ id: mcpServer.id })
}

private async requestTokens(
  tokenEndpoint: string,
  params: Record<string, string>,
): Promise<NonNullable<McpServerOauthState["tokens"]>> {
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  })
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
  }
  if (!response.ok || !body.access_token) {
    this.logger.warn(`MCP OAuth token request failed: ${response.status} ${body.error ?? ""}`)
    throw new BadRequestException(`OAuth token request failed (${body.error ?? response.status}).`)
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  }
}
```

- [ ] **Step 4: Run the spec — expect PASS**

- [ ] **Step 5: Gates and commit**

```bash
git add apps/api/src/domains/mcp-servers/oauth
git commit -m "feat(mcp): exchange OAuth authorization codes and store tokens

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Token refresh at connect time

**Files:**
- Modify: `apps/api/src/domains/mcp-servers/oauth/mcp-oauth.service.ts`
- Modify: `apps/api/src/domains/mcp-servers/mcp-servers.service.ts` (wire into `getEnabledServersForAgent`)
- Test: `apps/api/src/domains/mcp-servers/oauth/mcp-oauth.service.spec.ts`

**Interfaces:**
- Consumes: `requestTokens` (Task 5).
- Produces: `McpOauthService.getValidAccessToken(mcpServerId: string): Promise<string | null>`. `EnabledMcpServer` is unchanged: OAuth servers come out with `apiKey` set to the live access token, so `McpClientService`/`buildMcpRequestHeaders` need no change.

- [ ] **Step 1: Write the failing tests**

```typescript
describe("getValidAccessToken", () => {
  it("returns the stored token while it is fresh", async () => {
    // seed config.oauth.tokens = { accessToken: "at-1", expiresAt: Date.now() + 3600_000 }
    // expect "at-1" and NO fetch call
  })

  it("refreshes an expired token, persists the rotated refresh token, and returns the new one", async () => {
    // seed tokens = { accessToken: "old", refreshToken: "rt-1", expiresAt: Date.now() - 1000 }
    // mock token endpoint → { access_token: "at-2", refresh_token: "rt-2", expires_in: 3600 }
    // expect "at-2"; assert request body has grant_type=refresh_token, refresh_token=rt-1,
    // client_id, resource; assert persisted config has accessToken at-2 and refreshToken rt-2
  })

  it("keeps the previous refresh token when the response does not rotate it", async () => {
    // token response without refresh_token → persisted refreshToken stays "rt-1"
  })

  it("clears tokens and returns null when the refresh is rejected", async () => {
    // mock token endpoint → 400 { error: "invalid_grant" }
    // expect null; persisted config.oauth.tokens undefined (authStatus becomes oauthPending)
  })

  it("returns null for a server without oauth tokens", async () => {})
})
```

Also add a test on `McpServersService.getEnabledServersForAgent`: enable an OAuth-configured server for an agent and assert the returned `apiKey` equals the (refreshed) access token.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

In `McpOauthService` (inject `DataSource` from `typeorm` in the constructor — import `DataSource` as a runtime import with the biome-ignore DI comment, and get it via `@InjectDataSource()` from `@nestjs/typeorm`):

```typescript
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000

async getValidAccessToken(mcpServerId: string): Promise<string | null> {
  // Row lock: refresh tokens rotate, so two workers must not refresh at once.
  return this.dataSource.transaction(async (manager) => {
    const mcpServer = await manager.getRepository(McpServer).findOne({
      where: { id: mcpServerId },
      lock: { mode: "pessimistic_write" },
    })
    if (!mcpServer) return null
    const config = this.readConfig(mcpServer)
    const oauth = config.oauth
    if (!oauth?.tokens) return null

    if (oauth.tokens.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
      return oauth.tokens.accessToken
    }
    if (!oauth.tokens.refreshToken) return null

    try {
      const tokens = await this.requestTokens(oauth.tokenEndpoint, {
        grant_type: "refresh_token",
        refresh_token: oauth.tokens.refreshToken,
        client_id: oauth.clientId,
        resource: oauth.resource,
      })
      const mergedTokens = { ...tokens, refreshToken: tokens.refreshToken ?? oauth.tokens.refreshToken }
      await this.persistConfigWithManager(manager, mcpServerId, {
        ...config,
        oauth: { ...oauth, tokens: mergedTokens },
      })
      return mergedTokens.accessToken
    } catch (error) {
      this.logger.warn(
        `MCP OAuth refresh failed for server ${mcpServerId}: ${error instanceof Error ? error.message : error}`,
      )
      // Invalid grant: drop the tokens so the UI shows the server needs re-authorization.
      await this.persistConfigWithManager(manager, mcpServerId, {
        ...config,
        oauth: { ...oauth, tokens: undefined },
      })
      return null
    }
  })
}

private async persistConfigWithManager(
  manager: EntityManager,
  mcpServerId: string,
  config: McpServerConfig,
): Promise<void> {
  await manager
    .getRepository(McpServer)
    .update({ id: mcpServerId }, { encryptedConfig: this.encryptionService.encrypt(JSON.stringify(config)) })
}
```

(`EntityManager` is a type-only import from `typeorm`.) Refactor Task 4/5's `saveConfig` to call `persistConfigWithManager(this.dataSource.manager, ...)` so there is one write path.

In `McpServersService.getEnabledServersForAgent`, inject `McpOauthService` (runtime import with the DI biome-ignore comment) and replace the mapping:

```typescript
const enabledServers = agentMcpServers.filter((agentMcpServer) => agentMcpServer.mcpServer)
return Promise.all(
  enabledServers.map(async (agentMcpServer) => {
    const config = this.decryptConfig(agentMcpServer.mcpServer)
    if (!config.oauth) return { id: agentMcpServer.mcpServer.id, ...config }
    const accessToken = await this.mcpOauthService.getValidAccessToken(agentMcpServer.mcpServer.id)
    return { id: agentMcpServer.mcpServer.id, ...config, apiKey: accessToken ?? undefined }
  }),
)
```

Check for a circular-import warning (`mcp-servers.service.ts` ↔ `mcp-oauth.service.ts` via types): the oauth service imports only types from the service file, so madge may flag a cycle — if `cd apps/api && npm run check:boundaries` fails, move the `McpServerConfig`/`McpServerOauth*` types into a new `apps/api/src/domains/mcp-servers/mcp-server-config.types.ts` re-exported from `mcp-servers.service.ts`, rather than absorbing a baseline entry.

- [ ] **Step 4: Run the spec — expect PASS**

- [ ] **Step 5: Boundaries, gates and commit**

`cd apps/api && npm run check:boundaries`; from root `npm run biome:check`, `npm run typecheck`.

```bash
git add apps/api/src/domains/mcp-servers
git commit -m "feat(mcp): refresh OAuth access tokens when connecting to MCP servers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Controller endpoints + e2e tests

**Files:**
- Modify: `apps/api/src/domains/mcp-servers/mcp-servers.controller.ts`
- Test: `apps/api/src/domains/mcp-servers/e2e-tests/oauth.spec.ts` (new)

**Interfaces:**
- Consumes: `McpServersRoutes.initiateOauth` / `completeOauth` (Task 1), `McpOauthService` (Tasks 4–5).

- [ ] **Step 1: Write the failing e2e spec**

`apps/api/src/domains/mcp-servers/e2e-tests/oauth.spec.ts`, copying the scaffolding of `create-one.spec.ts` (same `setupE2eTestDatabase`, `createContext`, requester). Add at the top, before imports run: `process.env.MCP_OAUTH_REDIRECT_URL = "https://app.test/oauth/mcp/callback"` and `global.fetch = jest.fn()`. Create servers through the real `createOne` route. Tests:

```typescript
it("initiates OAuth and returns the authorization URL", async () => {
  // create a server via the createOne route, mock the 4 discovery/registration fetches,
  // POST initiateOauth, expectResponse(response, 201),
  // expect(response.body.data.authorizationUrl) to start with "https://auth.example.com/oauth2/authorize"
})

it("returns 400 when the MCP server does not support OAuth", async () => {
  // all discovery fetch mocks return 404 → expectResponse(response, 400)
})

it("completes OAuth and marks the server connected", async () => {
  // initiate first (grab state from the returned authorizationUrl's query),
  // mock the token endpoint fetch, POST completeOauth with { code: "code-1", state },
  // expectResponse(response, 201), expect(response.body.data.authStatus).toBe("oauthConnected")
})

it("rejects completion with a bad state", async () => {
  // POST completeOauth with state "wrong" → expectResponse(response, 400)
})

it("requires authentication on both routes", async () => {
  // accessToken = undefined → expectResponse(response, 401) for initiate and complete
})
```

- [ ] **Step 2: Run — expect FAIL (404, routes not implemented)**

From `apps/api`: `npx jest --colors --runInBand --forceExit src/domains/mcp-servers/e2e-tests/oauth.spec.ts`

- [ ] **Step 3: Implement the endpoints**

In `mcp-servers.controller.ts` (inject `McpOauthService` in the constructor with the DI biome-ignore comment; import `completeMcpServerOauthSchema` from the contracts):

```typescript
@Post(McpServersRoutes.initiateOauth.path)
@CheckPolicy((policy) => policy.canCreate())
@AddContext("mcpServer")
async initiateOauth(
  @Req() request: EndpointRequestWithMcpServer,
): Promise<typeof McpServersRoutes.initiateOauth.response> {
  const { authorizationUrl } = await this.mcpOauthService.initiateAuthorization(request.mcpServer)
  return { data: { authorizationUrl } }
}

@Post(McpServersRoutes.completeOauth.path)
@CheckPolicy((policy) => policy.canCreate())
@AddContext("mcpServer")
@UsePipes(new ZodValidationPipe(completeMcpServerOauthSchema))
async completeOauth(
  @Req() request: EndpointRequestWithMcpServer,
  @Body() { payload }: typeof McpServersRoutes.completeOauth.request,
): Promise<typeof McpServersRoutes.completeOauth.response> {
  const updated = await this.mcpOauthService.completeAuthorization({
    mcpServer: request.mcpServer,
    code: payload.code,
    state: payload.state,
  })
  const config = this.mcpServersService.getConfig(updated)
  return { data: toMcpServerDto(updated, config, this.mcpServersService.getAuthStatus(config)) }
}
```

- [ ] **Step 4: Run the e2e spec — expect PASS**

- [ ] **Step 5: Full domain suite, gates and commit**

From `apps/api`: `npx jest --colors --runInBand --forceExit src/domains/mcp-servers`. From root: `npm run biome:check`, `npm run typecheck`.

```bash
git add apps/api/src/domains/mcp-servers
git commit -m "feat(mcp): add OAuth initiate and complete endpoints for MCP servers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Web — SPI, API client, thunks, pending-auth storage

**Files:**
- Modify: `apps/web/src/studio/features/mcp-servers/mcp-servers.spi.ts`
- Modify: `apps/web/src/studio/features/mcp-servers/external/mcp-servers.api.ts`
- Modify: `apps/web/src/studio/features/mcp-servers/mcp-servers.thunks.ts`
- Create: `apps/web/src/studio/features/mcp-servers/mcp-oauth-storage.ts`

**Interfaces:**
- Consumes: `McpServersRoutes.initiateOauth`/`completeOauth`, `McpServerOauthInitiationDto` (Task 1).
- Produces: SPI methods `initiateOauth(params: McpServerScope): Promise<{ authorizationUrl: string }>` and `completeOauth(params: McpServerScope, payload: { code: string; state: string }): Promise<McpServer>`; thunks `initiateMcpServerOauth({ mcpServerId })` and `completeMcpServerOauth({ organizationId, projectId, mcpServerId, code, state })`; storage helpers `savePendingMcpOauthContext`, `takePendingMcpOauthContext` and type `PendingMcpOauthContext = { organizationId: string; projectId: string; mcpServerId: string }`.

- [ ] **Step 1: Storage helpers**

`mcp-oauth-storage.ts` — survives the full-page OAuth redirect (same idea as `HomeRoute.tsx`'s localStorage usage):

```typescript
const STORAGE_KEY = "mcpOauthPendingContext"

export type PendingMcpOauthContext = {
  organizationId: string
  projectId: string
  mcpServerId: string
}

export function savePendingMcpOauthContext(context: PendingMcpOauthContext): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(context))
  } catch {
    // Storage unavailable (private mode): the callback will show an error instead.
  }
}

/** Reads and clears the pending context — it is single-use. */
export function takePendingMcpOauthContext(): PendingMcpOauthContext | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    window.localStorage.removeItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingMcpOauthContext>
    if (!parsed.organizationId || !parsed.projectId || !parsed.mcpServerId) return null
    return { organizationId: parsed.organizationId, projectId: parsed.projectId, mcpServerId: parsed.mcpServerId }
  } catch {
    return null
  }
}
```

- [ ] **Step 2: SPI + API client**

In `mcp-servers.spi.ts` add to `IMcpServersSpi`:

```typescript
initiateOauth: (params: McpServerScope) => Promise<{ authorizationUrl: string }>
completeOauth: (params: McpServerScope, payload: { code: string; state: string }) => Promise<McpServer>
```

In `external/mcp-servers.api.ts` add the implementations (same shape as the existing methods):

```typescript
initiateOauth: async ({ organizationId, projectId, mcpServerId }) => {
  const axios = getAxiosInstance()
  const response = await axios.post<typeof McpServersRoutes.initiateOauth.response>(
    McpServersRoutes.initiateOauth.getPath({ organizationId, projectId, mcpServerId }),
  )
  return response.data.data
},
completeOauth: async ({ organizationId, projectId, mcpServerId }, payload) => {
  const axios = getAxiosInstance()
  const response = await axios.post<typeof McpServersRoutes.completeOauth.response>(
    McpServersRoutes.completeOauth.getPath({ organizationId, projectId, mcpServerId }),
    { payload } satisfies typeof McpServersRoutes.completeOauth.request,
  )
  return toMcpServer(response.data.data)
},
```

- [ ] **Step 3: Thunks**

In `mcp-servers.thunks.ts`:

```typescript
export const initiateMcpServerOauth = createAsyncThunk<void, { mcpServerId: string }, ThunkConfig>(
  "mcpServers/initiateOauth",
  async ({ mcpServerId }, { extra: { services }, getState, rejectWithValue }) => {
    try {
      const scope = currentProjectScope(getState())
      const { authorizationUrl } = await services.mcpServers.initiateOauth({ ...scope, mcpServerId })
      savePendingMcpOauthContext({ ...scope, mcpServerId })
      window.location.assign(authorizationUrl)
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, ""))
    }
  },
)

export const completeMcpServerOauth = createAsyncThunk<
  McpServer,
  { organizationId: string; projectId: string; mcpServerId: string; code: string; state: string },
  ThunkConfig
>(
  "mcpServers/completeOauth",
  async (
    { organizationId, projectId, mcpServerId, code, state },
    { extra: { services }, rejectWithValue },
  ) => {
    try {
      return await services.mcpServers.completeOauth(
        { organizationId, projectId, mcpServerId },
        { code, state },
      )
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, ""))
    }
  },
)
```

(`completeMcpServerOauth` takes explicit scope params because the callback route runs outside the studio route tree, before current IDs are set in Redux.)

- [ ] **Step 4: Gates and commit**

`npm run biome:check`, `npm run typecheck`.

```bash
git add apps/web/src/studio/features/mcp-servers
git commit -m "feat(web): add MCP OAuth SPI, thunks and redirect context storage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Web — OAuth callback route

**Files:**
- Create: `apps/web/src/common/routes/McpOauthCallbackRoute.tsx`
- Modify: `apps/web/src/common/routes/helpers.ts` (RouteNames)
- Modify: `apps/web/src/common/routes/Router.tsx`
- Create: `apps/web/src/stories/routes/common/McpOauthCallbackRoute.stories.tsx`
- Modify: `apps/web/src/common/locales/` — the common namespace files used by `useTranslation` for shared strings; if there is no suitable common namespace, put the keys in `apps/web/src/studio/features/mcp-servers/locales/mcp-servers.{en,fr}.json` under `oauthCallback` (preferred — the strings are MCP-specific).

**Interfaces:**
- Consumes: `completeMcpServerOauth`, `takePendingMcpOauthContext` (Task 8), `StudioRoutes.mcpServers` (`apps/web/src/studio/routes/helpers.ts:48`).
- Produces: route `RouteNames.MCP_OAUTH_CALLBACK = "/oauth/mcp/callback"` — the exact path segment of `MCP_OAUTH_REDIRECT_URL`.

- [ ] **Step 1: RouteNames + Router registration**

In `apps/web/src/common/routes/helpers.ts` add to the enum: `MCP_OAUTH_CALLBACK = "/oauth/mcp/callback"`.

In `Router.tsx`, add inside the `ProtectedRoute` children (the API call needs the user's JWT):

```tsx
{
  path: RouteNames.MCP_OAUTH_CALLBACK,
  element: <McpOauthCallbackRoute />,
},
```

- [ ] **Step 2: The callback component**

```tsx
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppDispatch } from "@/common/store/hooks"
import { completeMcpServerOauth } from "@/studio/features/mcp-servers/mcp-servers.thunks"
import { takePendingMcpOauthContext } from "@/studio/features/mcp-servers/mcp-oauth-storage"
import { StudioRoutes } from "@/studio/routes/helpers"

export function McpOauthCallbackRoute() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    // One-shot: the code is single-use, StrictMode double-mount must not re-run it.
    if (startedRef.current) return
    startedRef.current = true

    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const providerError = searchParams.get("error")
    const context = takePendingMcpOauthContext()

    if (providerError) {
      setError(t("mcpServers:oauthCallback.denied"))
      return
    }
    if (!code || !state || !context) {
      setError(t("mcpServers:oauthCallback.missingContext"))
      return
    }

    dispatch(completeMcpServerOauth({ ...context, code, state }))
      .unwrap()
      .then(() =>
        navigate(
          StudioRoutes.mcpServers.build({
            organizationId: context.organizationId,
            projectId: context.projectId,
          }),
          { replace: true },
        ),
      )
      .catch(() => setError(t("mcpServers:oauthCallback.failed")))
  }, [dispatch, navigate, searchParams, t])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-lg font-medium">{t("mcpServers:oauthCallback.errorTitle")}</p>
        <p className="text-muted-foreground">{error}</p>
      </div>
    )
  }
  return <LoadingRoute />
}
```

(This one-shot completion `useEffect` is a route-level lifecycle effect, same category as `HomeRoute`'s redirect handling — not a data-loading `useEffect` in a leaf component.)

- [ ] **Step 3: Locales**

Add to `apps/web/src/studio/features/mcp-servers/locales/mcp-servers.en.json`:

```json
"oauthCallback": {
  "errorTitle": "Authorization failed",
  "denied": "The authorization was denied by the provider.",
  "missingContext": "This authorization link is invalid or has expired. Start again from the MCP servers page.",
  "failed": "The server rejected the authorization. Start again from the MCP servers page."
}
```

And the French counterparts in `mcp-servers.fr.json`:

```json
"oauthCallback": {
  "errorTitle": "Échec de l'autorisation",
  "denied": "L'autorisation a été refusée par le fournisseur.",
  "missingContext": "Ce lien d'autorisation est invalide ou a expiré. Recommencez depuis la page des serveurs MCP.",
  "failed": "Le serveur a rejeté l'autorisation. Recommencez depuis la page des serveurs MCP."
}
```

- [ ] **Step 4: Story**

`apps/web/src/stories/routes/common/McpOauthCallbackRoute.stories.tsx`, mounting the real component in a memory router at the callback path. Follow the decorator/store-seeding structure of `apps/web/src/stories/routes/studio/DocumentsRoute.stories.tsx` (the canonical route-story reference) and expose two stories: `ProviderDenied` (`initialEntries: ["/oauth/mcp/callback?error=access_denied"]`) and `MissingContext` (`initialEntries: ["/oauth/mcp/callback"]`). Both render the error state without needing a mock service.

- [ ] **Step 5: Gates and commit**

`npm run biome:check`, `npm run typecheck`.

```bash
git add apps/web/src
git commit -m "feat(web): add the MCP OAuth callback route

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Web — authorize action and status in the MCP servers UI

**Files:**
- Modify: `apps/web/src/studio/features/mcp-servers/components/mcp-servers.types.ts`
- Modify: `apps/web/src/studio/features/mcp-servers/components/McpServerItem.tsx`
- Modify: `apps/web/src/studio/features/mcp-servers/components/McpServersList.tsx`
- Modify: `apps/web/src/studio/routes/McpServersRoute.tsx`
- Modify: `apps/web/src/studio/features/mcp-servers/components/CreateMcpServerDialog.tsx` (copy only)
- Modify: `apps/web/src/studio/features/mcp-servers/locales/mcp-servers.{en,fr}.json`
- Modify: `apps/web/src/stories/routes/studio/mcp-servers/McpServersList.stories.tsx` (cover the new states)

**Interfaces:**
- Consumes: `McpServerAuthStatus` (Task 1), `initiateMcpServerOauth` (Task 8).
- Produces: `McpServerDisplay.authStatus: McpServerAuthStatus`; `McpServerItem`/`McpServersList` gain an `onAuthorize: (id: string) => void` prop.

- [ ] **Step 1: Display type**

Add `authStatus: McpServerAuthStatus` to `McpServerDisplay` (type import from `@caseai-connect/api-contracts`).

- [ ] **Step 2: Item UI**

In `McpServerItem.tsx`, add the `onAuthorize` prop and render below the URL paragraph:

```tsx
{(mcpServer.authStatus === "none" || mcpServer.authStatus === "oauthPending") && (
  <Button variant="outline" size="sm" onClick={() => onAuthorize(mcpServer.id)}>
    {t("mcpServers:oauth.authorize")}
  </Button>
)}
{mcpServer.authStatus === "oauthConnected" && (
  <p className="text-sm text-muted-foreground">{t("mcpServers:oauth.connected")}</p>
)}
```

(Servers configured with an API key — `authStatus === "apiKey"` — show nothing new.)

- [ ] **Step 3: Wire through the list and the route**

`McpServersList.tsx`: add `onAuthorize: (id: string) => void` to props and pass it to each `McpServerItem`.

`McpServersRoute.tsx`: add

```tsx
const handleAuthorize = (mcpServerId: string) => {
  dispatch(initiateMcpServerOauth({ mcpServerId }))
}
```

and pass `onAuthorize={handleAuthorize}` to `McpServersList`.

- [ ] **Step 4: Dialog copy + locales**

Update the locales (both languages):

`mcp-servers.en.json` — change `fields.apiKeyPlaceholder` to `"Optional — leave empty for OAuth servers"` and add:

```json
"oauth": {
  "authorize": "Authorize",
  "connected": "Connected via OAuth"
}
```

`mcp-servers.fr.json` — the matching French: `fields.apiKeyPlaceholder`: `"Optionnelle — laisser vide pour les serveurs OAuth"`, and:

```json
"oauth": {
  "authorize": "Autoriser",
  "connected": "Connecté via OAuth"
}
```

- [ ] **Step 5: Stories**

In `McpServersList.stories.tsx`, seed servers with each `authStatus` (via `mcpServerFactory.build({ authStatus: "oauthPending" }, { transient: { project } })` etc.) so the authorize button and connected label are visible in Storybook.

- [ ] **Step 6: Gates and commit**

`npm run biome:check`, `npm run typecheck`.

```bash
git add apps/web/src
git commit -m "feat(web): surface MCP server auth status and OAuth authorize action

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Changelog and full verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Changelog entry**

Add under the Unreleased section, following the file's existing entry style (one sentence, max 20 words, end-user wording):

```markdown
- MCP servers: connect servers that use OAuth by authorizing access in the browser, alongside API keys.
```

- [ ] **Step 2: Full API suite**

`cd apps/api && npm run test:parallel` — all green (re-run known-flaky failures in isolation per repo policy).

- [ ] **Step 3: Full gates**

From root: `npm run biome:check`, `npm run typecheck`. From `apps/api`: `npm run check:boundaries`.

- [ ] **Step 4: Manual smoke test against Coros (optional but recommended)**

With dev servers running and `MCP_OAUTH_REDIRECT_URL` set in `apps/api/.env`: add `https://mcp.coros.com/mcp` as an MCP server without an API key, click Authorize, consent on the Coros page, verify the redirect lands back and the card shows "Connected", then enable it for an agent and check its tools load in a session.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): MCP OAuth authorization entry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Out of scope (deliberate)

- Per-user OAuth tokens (tokens are project-level, like API keys today).
- Device-code flow (authorization code + PKCE is what the MCP spec mandates; device flow can come later for providers that offer it).
- Revoking tokens on server deletion (the provider-side grant survives; acceptable for v1).
- A generic `updateOne` route for MCP servers (the OAuth endpoints are purpose-built mutations).
- Mid-session token refresh with reconnection (headers are frozen per connection; each new session/connection picks up a fresh token, which matches how connections are created today).
