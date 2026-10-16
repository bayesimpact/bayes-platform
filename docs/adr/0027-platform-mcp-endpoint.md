# ADR 0027: Platform MCP endpoint for agent creation

* **Status**: Proposed
* **Date**: 2026-10-13
* **Deciders**: Jérémie
* **Amended by**: [ADR 0028](0028-oauth-authorization-server.md) (authentication)
* **Scope**: `apps/api` (`domains/mcp-endpoint`, `config/api-prefix.ts`)

---

## 1. Context

The platform consumes MCP servers (agents call their tools), but exposes none.
People who work in an MCP client (Claude, an IDE, an agent framework) want to
create agents on the platform from there, without opening the studio.

## 2. Decision

**The API serves an MCP endpoint at `/api/mcp`. A person connects an MCP
client through the API's authorization server (ADR 0028), chooses projects and
permissions, and the client gets two tools: `list_projects` and
`create_agent`.**

### 2.1 Protocol

* The endpoint is built on the v2 TypeScript SDK (`@modelcontextprotocol/server`
  and `@modelcontextprotocol/node`), which implements the 2026-07-28
  specification.
* `createMcpHandler` serves the 2026-07-28 protocol and falls back to stateless
  serving for 2025 clients, from one server factory. Both are tested.
* The endpoint is stateless: one `McpServer` per HTTP request, bound to the
  signed-in user. Nothing lives in memory between requests, so it scales
  with the API replicas and needs no session store.
* Tools declare an output schema and return `structuredContent`, with
  annotations (`readOnlyHint` on `list_projects`). A refused call is a tool
  error (`isError`) with a readable message, so the model can correct itself.

### 2.2 Authentication

* The endpoint is an OAuth resource server. It accepts only the access tokens
  of the API's authorization server issued for it (ADR 0028); a token of the
  web app is refused.
* A call without a valid token answers `401` with
  `WWW-Authenticate: Bearer resource_metadata="…"`. The protected resource
  metadata (RFC 9728) is served at
  `/.well-known/oauth-protected-resource/api/mcp`, outside the `api` prefix,
  and names the API's authorization server.

### 2.3 Authorization

* The tools run the checks of the HTTP routes: `project.read` to list
  projects, `agent.create` on the project to create an agent. They go through
  `PermissionService`, and creation goes through `AgentsService.createAgent`.
* On top of it, the grant limits the tools to its projects and permissions.
* A missing project, a project outside the grant and a project the person
  cannot create agents in get the same answer.
* Creation records the `agent.create` activity, like the HTTP route.

## 3. Consequences

* MCP clients can create agents with the web app's defaults (all documents,
  no tags, no categories). The rest of the configuration stays in the studio,
  which the tool links to when `APP_PUBLIC_URL` or `FRONTEND_URL` is set.
* New tools go in `agent-creation-mcp-server.ts` and reuse domain services,
  never repositories directly.
