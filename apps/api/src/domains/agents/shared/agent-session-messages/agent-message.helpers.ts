import type {
  AgentSessionMcpAppHtmlDto,
  AgentSessionMessageDto,
  AgentSessionToolCallDto,
} from "@caseai-connect/api-contracts"
import type { AgentMessage, AgentMessageToolCall } from "./agent-message.entity"

const MCP_APP_HTML_CACHE_KEY_SEPARATOR = "::"

export function mcpAppHtmlCacheKey(mcpServerId: string, resourceUri: string): string {
  return `${mcpServerId}${MCP_APP_HTML_CACHE_KEY_SEPARATOR}${resourceUri}`
}

/**
 * The live HTML map as the client receives it: one entry per server and `ui://` the
 * transcript points at. The client matches each tool call's pointer against it.
 */
export function toMcpAppHtmlDtos(htmlByKey: Map<string, string>): AgentSessionMcpAppHtmlDto[] {
  return [...htmlByKey].map(([cacheKey, html]) => {
    // A server id is a uuid and never contains the separator, so the first one splits the key.
    const separatorIndex = cacheKey.indexOf(MCP_APP_HTML_CACHE_KEY_SEPARATOR)
    return {
      mcpServerId: cacheKey.slice(0, separatorIndex),
      resourceUri: cacheKey.slice(separatorIndex + MCP_APP_HTML_CACHE_KEY_SEPARATOR.length),
      html,
    }
  })
}

function liveHtmlForMcpApp(
  mcpApp: { mcpServerId?: string; resourceUri: string },
  htmlByKey: Map<string, string>,
): string | undefined {
  if (mcpApp.mcpServerId) {
    return htmlByKey.get(mcpAppHtmlCacheKey(mcpApp.mcpServerId, mcpApp.resourceUri))
  }

  const suffix = `::${mcpApp.resourceUri}`
  for (const [cacheKey, html] of htmlByKey) {
    if (cacheKey.endsWith(suffix)) return html
  }
  return undefined
}

export function applyLiveMcpAppHtml(
  toolCalls: AgentMessageToolCall[] | null | undefined,
  htmlByKey: Map<string, string>,
): AgentSessionToolCallDto[] | undefined {
  if (!toolCalls) return undefined

  return toolCalls.map((toolCall) => {
    const mcpApp = toolCall.mcpApp
    if (!mcpApp) return toolCall

    const html = liveHtmlForMcpApp(mcpApp, htmlByKey)
    return {
      ...toolCall,
      mcpApp: {
        mcpServerId: mcpApp.mcpServerId,
        resourceUri: mcpApp.resourceUri,
        ...(html ? { html } : {}),
      },
    }
  })
}

export function toDto(
  message: AgentMessage,
  htmlByKey: Map<string, string> = new Map(),
): AgentSessionMessageDto {
  if (!message.agentSettings) {
    throw new Error("Agent settings must be loaded to convert message to DTO")
  }

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status ?? undefined,
    createdAt: message.createdAt.getTime(),
    startedAt: message.startedAt?.getTime(),
    completedAt: message.completedAt?.getTime(),
    agentRevision: message.agentSettings.revision,
    toolCalls: applyLiveMcpAppHtml(message.toolCalls, htmlByKey),
    attachmentDocumentId: message.attachmentDocumentId ?? undefined,
  }
}

export function toDtos(
  messages: AgentMessage[],
  htmlByKey: Map<string, string> = new Map(),
): AgentSessionMessageDto[] {
  return messages.map((message) => toDto(message, htmlByKey))
}
