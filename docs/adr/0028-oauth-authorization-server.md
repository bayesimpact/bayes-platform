# ADR 0028: OAuth authorization server for MCP clients and apps

* **Status**: Proposed
* **Date**: 2026-10-13
* **Deciders**: Jérémie
* **Amends**: [ADR 0027](0027-platform-mcp-endpoint.md) (authentication of the MCP endpoint). Prepares the replacement of the install flow of [ADR 0024](0024-conversation-apps.md).
* **Scope**: `apps/api` (`domains/oauth`, `domains/mcp-endpoint`), `apps/web` (consent page), API contracts.

---

## 1. Context

The MCP endpoint of ADR 0027 accepts the user's own OIDC token. An MCP client
then holds every right of the person on the whole private API, the person
chooses nothing when connecting it, and nothing in the platform lists or
revokes it. Each identity provider also behaves differently for client
registration and audiences, which ties the endpoint to Keycloak or Auth0
settings.

Apps have the opposite: a consent page (project and permissions), a
single-use code with PKCE, tokens issued by the API, and revocation from the
studio. But their flow is custom (`apps/install/:slug/authorize`, then
`apps/v1/install/exchange`), so each app client carries its own OAuth code.

## 2. Decision

**The API is an OAuth 2.1 authorization server. The OIDC provider only
authenticates the person; the API issues the tokens for MCP clients, and later
for apps. MCP clients use it first.**

### 2.1 Endpoints

* Metadata (RFC 8414) at `/.well-known/oauth-authorization-server/api/oauth`.
  The issuer is `<origin>/api/oauth`. The protected resource metadata of the
  MCP endpoint (ADR 0027) now names this issuer instead of the OIDC provider.
* `POST /api/oauth/register`: dynamic client registration (RFC 7591).
* `<web>/oauth/authorize`: the authorization endpoint is a page of the web
  app. The person signs in with OIDC as usual, sees the client, picks the
  projects and the permissions, and approves or denies.
* `POST /api/oauth/token`: `authorization_code` with PKCE, and
  `refresh_token`. `client_credentials` is reserved for apps.
* `POST /api/oauth/revoke` (RFC 7009) for a refresh token.
* Only public clients for now: `token_endpoint_auth_method` is `none`, PKCE
  `S256` is mandatory, `response_type` is `code`.

### 2.2 Clients: CIMD and DCR

* **Client ID metadata documents** (CIMD), the method the MCP specification
  recommends: the `client_id` is an `https` URL. The API fetches it, checks
  that its `client_id` equals the URL, and keeps it an hour. The domain is
  shown as verified on the consent page.
* **Dynamic client registration** (DCR), for clients that do not support
  CIMD yet: the API creates a `client_id`. The name is declared by the client,
  so the consent page shows the domain of the redirect URI and marks the
  client unverified.
* Fetching a CIMD document is a request to a URL chosen outside the platform
  (SSRF). The fetch accepts `https` on port 443 only, resolves the name and
  connects only to public addresses (no private, loopback or link-local
  address, the resolved address is the one used), follows no redirect, and
  stops after 5 seconds or 5 KB.
* Redirect URIs are `https`, or loopback for local clients, and match
  exactly.
* A DCR client without any grant after 24 hours is deleted, along with
  expired codes and refresh tokens, when a new client registers.
  Registration is the only way to add rows without signing in, and its rate
  limit bounds the cost, so no worker queue is needed.

### 2.3 Grants and tokens

* A grant links a person, a client, one or more projects and a set of
  permissions taken from a short list of grantable permissions:
  `project.read` and `agent.create`, checked on the project, and
  `agent.settings.draft.update`, checked on each agent (the person must own
  or administer it). The latter is offered on every visible project, since it
  depends on the agent. Publishing is not grantable yet: drafts written by a
  client are published by a person in the studio.
* The client acts as the person. An action is allowed only when the person
  holds the permission on the project now (RBAC, ADR 0019) and granted it to
  the client on that project. Losing a role takes the right away from the
  client at once.
* Access tokens are RS256 JWTs signed by the API, valid 15 minutes, with
  the MCP endpoint URL as audience (RFC 8707), the person as subject and the
  grant id. A token of the web app is no longer accepted on `/api/mcp`, and a
  grant token is not accepted on the rest of the private API.
* Refresh tokens are opaque, stored hashed, valid 7 days and rotated at each
  use. Presenting a used refresh token again revokes the grant (reuse
  detection).
* Each request to the MCP endpoint loads the grant: a revoked grant stops at
  once, even with an access token still valid.
* Codes are single-use, stored hashed, valid 5 minutes, and bound to the
  client, the redirect URI, the PKCE challenge and the resource.
* The person lists and revokes their grants.

### 2.4 Rate limits

* `@nestjs/throttler` with Redis storage (`@nest-lab/throttler-storage-redis`,
  the BullMQ Redis), so the counters are shared by the API replicas.
* Applied to the OAuth controllers only: per IP and global on registration,
  per IP and per client on the token endpoint, per user on consent.
* The IP is hashed with a server secret before it becomes a Redis key.

## 3. Consequences

* An MCP client works the same whatever the identity provider: the provider
  needs no DCR, CIMD or audience setting.
* What a client can do is chosen at connection time, limited to the
  `/api/mcp` endpoint, visible and revocable.
* Apps keep their flow for now. Moving them to this server means a
  `client_credentials` grant for the service user and the consent page in
  place of `apps/install/:slug`, with the old endpoints kept during the
  transition.
* The API holds a new signing key use: it signs with the apps key pair
  (`APPS_JWT_PRIVATE_KEY`), which becomes the key of the authorization server.
