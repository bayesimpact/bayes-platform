import { Injectable, Logger } from "@nestjs/common"
import type { AgentMessageToolCall } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import type { EnabledMcpServer } from "@/domains/mcp-servers/mcp-servers.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpServersService } from "@/domains/mcp-servers/mcp-servers.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpClientService } from "@/external/mcp"
import { readMcpAppHtml } from "@/external/mcp/mcp-app-resource"
import type { McpSession } from "@/external/mcp/mcp-client.service"
import type { McpConversationContext } from "@/external/mcp/mcp-request-headers"
import { mcpAppHtmlCacheKey } from "./agent-message.helpers"

/** A `ui://` card pointer persisted on a tool call — not the HTML snapshot. */
type McpAppRef = {
  mcpServerId?: string
  resourceUri: string
}

/**
 * Unique MCP App pointers on this timeline. Ignores non-`ui://` values so a
 * stored junk URI cannot become a `resources/read`. Dedupes by server + URI
 * because a conversation may repeat the same card many times.
 */
function collectMcpAppRefs(
  messages: Array<{ toolCalls?: AgentMessageToolCall[] | null }>,
): McpAppRef[] {
  const refs: McpAppRef[] = []
  const seen = new Set<string>()

  for (const message of messages) {
    for (const toolCall of message.toolCalls ?? []) {
      const resourceUri = toolCall.mcpApp?.resourceUri
      if (typeof resourceUri !== "string" || !resourceUri.startsWith("ui://")) continue

      const mcpServerId =
        typeof toolCall.mcpApp?.mcpServerId === "string" ? toolCall.mcpApp.mcpServerId : undefined
      const dedupeKey = `${mcpServerId ?? "*"}::${resourceUri}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      refs.push({ mcpServerId, resourceUri })
    }
  }

  return refs
}

/**
 * Which enabled server should serve each URI. A pointer names its server; if
 * that server is no longer enabled for the agent, it is skipped (fail closed).
 * Pointers without `mcpServerId` (legacy rows) are tried on every enabled
 * server — still only `ui://`, never an arbitrary URL.
 */
function groupUrisByEnabledServer(
  refs: McpAppRef[],
  enabledServers: EnabledMcpServer[],
): Map<EnabledMcpServer, Set<string>> {
  const serversById = new Map(enabledServers.map((server) => [server.id, server] as const))
  const urisByServer = new Map<EnabledMcpServer, Set<string>>()

  for (const ref of refs) {
    const targetServers = ref.mcpServerId
      ? [serversById.get(ref.mcpServerId)].filter(
          (server): server is EnabledMcpServer => server !== undefined,
        )
      : enabledServers

    for (const server of targetServers) {
      const uris = urisByServer.get(server) ?? new Set<string>()
      uris.add(ref.resourceUri)
      urisByServer.set(server, uris)
    }
  }

  return urisByServer
}

/**
 * Loads current MCP App HTML when messages are returned to the client.
 *
 * Tool calls persist only `{ mcpServerId, resourceUri }`. Storing the HTML
 * would freeze the card UI, so old conversations would miss server-side style
 * updates. This service re-reads each declared `ui://` from the same enabled
 * MCP server. Missing HTML is fine: the DTO omits it and the chat falls back
 * to the timeline instead of breaking the message.
 */
@Injectable()
export class McpAppHtmlService {
  private readonly logger = new Logger(McpAppHtmlService.name)

  constructor(
    private readonly mcpClientService: McpClientService,
    private readonly mcpServersService: McpServersService,
  ) {}

  /**
   * Current HTML keyed by `mcpServerId::resourceUri`. Empty when the timeline
   * has no MCP Apps, so we never open an MCP connection for ordinary chats.
   */
  async readLiveHtml({
    agentId,
    sessionId,
    messages,
    externalVisitorId = null,
    locale = null,
  }: {
    agentId: string
    sessionId: string
    messages: Array<{ toolCalls?: AgentMessageToolCall[] | null }>
    /** Forwarded on public/embed sessions so MCP servers can attribute the read. */
    externalVisitorId?: string | null
    /** The agent's language, so a server can hand back a card written in it. */
    locale?: string | null
  }): Promise<Map<string, string>> {
    const refs = collectMcpAppRefs(messages)
    if (refs.length === 0) return new Map()

    const enabledServers = await this.mcpServersService.getEnabledServersForAgent(agentId)
    const htmlByKey = new Map<string, string>()
    const context: McpConversationContext = { agentId, sessionId, externalVisitorId, locale }

    for (const [server, resourceUris] of groupUrisByEnabledServer(refs, enabledServers)) {
      await this.readHtmlFromServer({ context, htmlByKey, resourceUris, server })
    }

    return htmlByKey
  }

  /**
   * One MCP session per server. URIs on that session are read sequentially:
   * a conversation almost always repeats a single `ui://`, so fan-out would
   * not shorten the wait, and some MCP transports are not concurrent-safe.
   */
  private async readHtmlFromServer({
    context,
    htmlByKey,
    resourceUris,
    server,
  }: {
    context: McpConversationContext
    htmlByKey: Map<string, string>
    resourceUris: Set<string>
    server: EnabledMcpServer
  }): Promise<void> {
    const mcpSession = await this.mcpClientService.connect({ ...server, context })
    try {
      for (const resourceUri of resourceUris) {
        await this.tryReadResource({ htmlByKey, mcpServerId: server.id, mcpSession, resourceUri })
      }
    } finally {
      await mcpSession.close()
    }
  }

  /**
   * Best-effort `resources/read`. MIME / URI checks live in `readMcpAppHtml`.
   * Failures are logged without payloads and left out of the map so one bad
   * card cannot fail the message list.
   */
  private async tryReadResource({
    htmlByKey,
    mcpServerId,
    mcpSession,
    resourceUri,
  }: {
    htmlByKey: Map<string, string>
    mcpServerId: string
    mcpSession: McpSession
    resourceUri: string
  }): Promise<void> {
    try {
      const html = readMcpAppHtml({
        resourceUri,
        resource: await mcpSession.readResource(resourceUri),
      })
      htmlByKey.set(mcpAppHtmlCacheKey(mcpServerId, resourceUri), html)
      this.logger.log("MCP App resource read", { mcpServerId, resourceUri })
    } catch (error) {
      this.logger.warn("MCP App resource read failed", {
        error: error instanceof Error ? error.message : String(error),
        mcpServerId,
        resourceUri,
      })
    }
  }
}
