import { Injectable, Logger } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsRepository } from "@/domains/agents/settings/agent-settings.repository"
import type { AgentMessageToolCall } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import type { EnabledMcpServer } from "@/domains/mcp-servers/mcp-servers.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpServersService } from "@/domains/mcp-servers/mcp-servers.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { McpClientService } from "@/external/mcp"
import { type McpAppResource, readMcpAppResource } from "@/external/mcp/mcp-app-resource"
import type { McpSession } from "@/external/mcp/mcp-client.service"
import type { McpConversationContext } from "@/external/mcp/mcp-request-headers"
import { mcpAppHtmlCacheKey } from "./agent-message.helpers"

/** A message as this service reads it: its tool calls and the settings revision that wrote it. */
type MessageWithMcpApps = {
  toolCalls?: AgentMessageToolCall[] | null
  agentSettingsId?: string | null
  /** The loaded relation, when the caller has it: it saves the lookup of the author. */
  agentSettings?: { agentId: string } | null
}

/** A `ui://` card pointer persisted on a tool call — not the HTML snapshot. */
type McpAppRef = {
  mcpServerId?: string
  resourceUri: string
}

/** The `ui://` pointers of one message. Ignores other values so a stored junk URI cannot become a `resources/read`. */
function mcpAppRefsOf(message: MessageWithMcpApps): McpAppRef[] {
  const refs: McpAppRef[] = []
  for (const toolCall of message.toolCalls ?? []) {
    const resourceUri = toolCall.mcpApp?.resourceUri
    if (typeof resourceUri !== "string" || !resourceUri.startsWith("ui://")) continue

    const mcpServerId =
      typeof toolCall.mcpApp?.mcpServerId === "string" ? toolCall.mcpApp.mcpServerId : undefined
    refs.push({ mcpServerId, resourceUri })
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
 * updates. This service re-reads each declared `ui://` from the same MCP
 * server, as long as it is still enabled for the agent that wrote the message.
 * Missing HTML is fine: the DTO omits it and the chat falls back
 * to the timeline instead of breaking the message.
 */
@Injectable()
export class McpAppHtmlService {
  private readonly logger = new Logger(McpAppHtmlService.name)

  constructor(
    private readonly mcpClientService: McpClientService,
    private readonly mcpServersService: McpServersService,
    private readonly agentSettingsRepository: AgentSettingsRepository,
  ) {}

  /**
   * Current HTML, with the domains each card declares, keyed by `mcpServerId::resourceUri`. Empty when the timeline
   * has no MCP Apps, so we never open an MCP connection for ordinary chats.
   */
  async readLiveHtml({
    agentId,
    connectScope,
    sessionId,
    messages,
    externalVisitorId = null,
  }: {
    /** The session's agent: the author of a message whose settings revision is unknown. */
    agentId: string
    connectScope: RequiredConnectScope
    sessionId: string
    messages: MessageWithMcpApps[]
    /** Forwarded on public/embed sessions so MCP servers can attribute the read. */
    externalVisitorId?: string | null
  }): Promise<Map<string, McpAppResource>> {
    const refsByAgent = await this.collectRefsByAuthorAgent({ agentId, connectScope, messages })
    const htmlByKey = new Map<string, McpAppResource>()

    // Each author agent is read with its own enabled servers and its own id in
    // the context, as when it called the tool.
    for (const [authorAgentId, refs] of refsByAgent) {
      const enabledServers = await this.mcpServersService.getEnabledServersForAgent(authorAgentId)
      const context: McpConversationContext = {
        agentId: authorAgentId,
        sessionId,
        externalVisitorId,
      }

      for (const [server, resourceUris] of groupUrisByEnabledServer(refs, enabledServers)) {
        const missingUris = new Set(
          [...resourceUris].filter((uri) => !htmlByKey.has(mcpAppHtmlCacheKey(server.id, uri))),
        )
        if (missingUris.size === 0) continue
        await this.readHtmlFromServer({ context, htmlByKey, resourceUris: missingUris, server })
      }
    }

    return htmlByKey
  }

  /**
   * The MCP App pointers of the timeline, grouped by the agent that wrote the
   * message. After a handoff a sub-agent writes in the session of the
   * meta-agent, and its card lives on a server only the sub-agent has. So the
   * author comes from the settings revision of the message, not from the
   * session. Makes no query when no message has a card.
   */
  private async collectRefsByAuthorAgent({
    agentId,
    connectScope,
    messages,
  }: {
    agentId: string
    connectScope: RequiredConnectScope
    messages: MessageWithMcpApps[]
  }): Promise<Map<string, McpAppRef[]>> {
    const messagesWithRefs = messages
      .map((message) => ({ message, refs: mcpAppRefsOf(message) }))
      .filter(({ refs }) => refs.length > 0)

    const settingsIdsToResolve = new Set<string>()
    for (const { message } of messagesWithRefs) {
      if (!message.agentSettings && message.agentSettingsId) {
        settingsIdsToResolve.add(message.agentSettingsId)
      }
    }
    const agentIdBySettingsId = await this.agentSettingsRepository.findAgentIdsBySettingsIds(
      connectScope,
      [...settingsIdsToResolve],
    )

    const refsByAgent = new Map<string, McpAppRef[]>()
    for (const { message, refs } of messagesWithRefs) {
      const authorAgentId =
        message.agentSettings?.agentId ??
        (message.agentSettingsId ? agentIdBySettingsId.get(message.agentSettingsId) : undefined) ??
        agentId
      refsByAgent.set(authorAgentId, [...(refsByAgent.get(authorAgentId) ?? []), ...refs])
    }
    return refsByAgent
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
    htmlByKey: Map<string, McpAppResource>
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
   * Best-effort `resources/read`. MIME / URI checks live in `readMcpAppResource`.
   * Failures are logged without payloads and left out of the map so one bad
   * card cannot fail the message list.
   */
  private async tryReadResource({
    htmlByKey,
    mcpServerId,
    mcpSession,
    resourceUri,
  }: {
    htmlByKey: Map<string, McpAppResource>
    mcpServerId: string
    mcpSession: McpSession
    resourceUri: string
  }): Promise<void> {
    try {
      const appResource = readMcpAppResource({
        resourceUri,
        resource: await mcpSession.readResource(resourceUri),
      })
      htmlByKey.set(mcpAppHtmlCacheKey(mcpServerId, resourceUri), appResource)
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
