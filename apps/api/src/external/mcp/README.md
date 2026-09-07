# MCP Server Integration

Generic integration for external MCP (Model Context Protocol) servers. Supports preset servers (e.g., Bayes Social) and future custom user-provided servers.

## Architecture

- **`mcp_server`** table: catalog of available servers (presets and custom), with encrypted connection config
- **`agent_mcp_server`** table: junction enabling specific servers per agent
- At runtime, the streaming service queries all enabled servers for the agent, connects to each, and merges their tools

## Built-in servers

Some MCP servers are provided by the platform itself. They carry one of the slugs allowlisted in `BUILT_IN_PRESET_SLUGS` (`domains/mcp-servers/built-in/built-in-mcp-servers.ts`), belong to no project (`project_id` is null), are listed in every project and cannot be deleted — admins only toggle them per agent. Other preset rows (seeded by `npm run seed:mcp-preset`) are not built-in: they stay out of the listings and remain deletable.

| Slug | Server | Requires |
|------|--------|----------|
| `pdf-export` | "PDF export" (`apps/pdf-converter`) | `PDF_CONVERTER_URL` |

- **Boot sync**: `BuiltInMcpServersService.syncFromEnvironment()` runs once in `main.ts`, before the API listens. It upserts the row on its preset slug, so it creates the row, refreshes its URL when the service moves, and restores it if it was deleted by hand. Without `PDF_CONVERTER_URL` the server is skipped and never listed.
- **IAM audience**: when `PDF_CONVERTER_AUTH=google-iam` (set by terraform in production, where the converter is locked behind Cloud Run invoker IAM), the enabled-server config carries a `googleIamAudience` — the converter URL origin. `McpClientService` then mints a Google ID token for it and sends it as `Authorization`, overriding any configured API key.
- **Deletion**: `DELETE …/mcp-servers/:mcpServerId` on a built-in server answers 403, both in the policy and in `McpServersService.deleteMcpServer`.
- **Storage**: temporary PDF exports are swept by the workers; see `apps/api/src/domains/documents/pdf-exports/README.md`.

## Configuration

| Env var | Description |
|---------|-------------|
| `MCP_ENCRYPTION_KEY` | 64-character hex string (32 bytes) for AES-256-GCM encryption of server configs |
| `PDF_CONVERTER_URL` | Enables the built-in "PDF export" server, at `<PDF_CONVERTER_URL>/mcp` |
| `PDF_CONVERTER_AUTH` | `google-iam` to authenticate to it with a Google ID token |

Generate a key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Setup

### 1. Create an MCP server preset

```bash
cd apps/api && npm run seed:mcp-preset
```

### 2. Enable the server for an agent

```sql
INSERT INTO agent_mcp_server (id, agent_id, mcp_server_id, enabled, created_at, updated_at)
VALUES (gen_random_uuid(), '<agent_id>', '<mcp_server_id>', true, now(), now());
```
