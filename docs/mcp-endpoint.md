# MCP endpoint

The platform serves an MCP server at `/api/mcp`, for MCP clients (Claude, IDEs, agent frameworks) that create agents. Decisions: [ADR 0027](adr/0027-platform-mcp-endpoint.md) for the endpoint, [ADR 0028](adr/0028-oauth-authorization-server.md) for its authorization server.

## Connect a client

Give the client the endpoint URL, for example `https://connect.example.org/api/mcp`. The client does the rest:

1. It calls the endpoint, gets a `401`, and reads the protected resource metadata named in the `WWW-Authenticate` header.
2. It reads the metadata of the authorization server, at `/.well-known/oauth-authorization-server/api/oauth`.
3. It identifies itself: a client ID metadata document URL as `client_id` (CIMD), or a registration at `/api/oauth/register` (DCR).
4. It opens the consent page of the web app, `/oauth/authorize`. The person signs in, picks projects and permissions, and approves.
5. It exchanges the code at `/api/oauth/token` with its PKCE verifier, and calls the endpoint with the access token.

Access tokens last 15 minutes, refresh tokens 7 days. The person sees and revokes the clients they connected; a revoked client stops at its next call.

## Tools

| Tool | Needs | Does |
| --- | --- | --- |
| `list_projects` | `project.read` granted | Lists the granted projects the person can still see, and whether agents can be created in each. |
| `create_agent` | `agent.create` granted on the project, and held by the person | Creates an agent with the web app's defaults and publishes its first version. Returns a studio link. |
| `list_agents` | `project.read` granted on the project | Lists the agents of the project the person is a member of, with their model and whether `update_agent` can change them. |
| `update_agent` | `agent.settings.draft.update` granted on the project, and the person owns or administers the agent | Changes the model, instructions, language or greeting in the agent's draft. Nothing is published: the person publishes the draft in the studio. |

A right needs both: the person holds it on the project now, and granted it to the client.

## Endpoints

| Path | Use |
| --- | --- |
| `GET /.well-known/oauth-protected-resource/api/mcp` | RFC 9728 metadata of the MCP endpoint |
| `GET /.well-known/oauth-authorization-server/api/oauth` | RFC 8414 metadata of the authorization server |
| `POST /api/oauth/register` | RFC 7591 registration of a public client |
| `/oauth/authorize` (web app) | Consent page, the authorization endpoint |
| `POST /api/oauth/token` | Code and refresh token exchange, form-encoded |
| `POST /api/oauth/revoke` | RFC 7009 revocation of a refresh token |
| `POST /api/mcp` | The MCP endpoint (Streamable HTTP, 2026-07-28 and 2025 clients) |

## Deployment

- `API_PUBLIC_URL` is the base of the issuer and of the endpoint URL. The Helm chart sets it from `urls.api`. Give MCP clients `<API_PUBLIC_URL>/api/mcp`. When the web app and the API answer on different hosts, it is required: the consent goes through the web host, the token through the API host, and both must name the same resource.
- The `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` paths must reach the API on that host. The Helm ingress routes them; another proxy that routes only `/api` and `/public` needs them added.
- Without `API_PUBLIC_URL` (one host for everything, as in local environments), URLs follow the request: the proxy must pass the original `Host` and `X-Forwarded-Proto`.
- Tokens are signed with the OAuth signing key pair (`OAUTH_SIGNING_PRIVATE_KEY`, `OAUTH_SIGNING_PUBLIC_KEY`).
- Rate limits count in the BullMQ Redis (`BULLMQ_REDIS_URL`).
