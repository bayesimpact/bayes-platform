import { createMCPClient, type MCPClient } from "@ai-sdk/mcp"
import { Injectable, Logger } from "@nestjs/common"
import type { ToolSet } from "ai"
import {
  buildMcpRequestHeaders,
  type McpConversationContext,
} from "@/external/mcp/mcp-request-headers"
import { MCP_APP_MIME_TYPE } from "./mcp-app-resource"

const MCP_APP_CLIENT_CAPABILITIES = {
  extensions: {
    "io.modelcontextprotocol/ui": {
      mimeTypes: [MCP_APP_MIME_TYPE],
    },
  },
}

export type McpResourceReadResult = Awaited<ReturnType<MCPClient["readResource"]>>

export type McpSession = {
  tools: ToolSet
  close: () => Promise<void>
  readResource: (uri: string) => Promise<McpResourceReadResult>
}

@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name)

  async connect(config: {
    url: string
    apiKey?: string
    /** Static headers from the server's configuration. */
    headers?: Record<string, string>
    /** Conversation the tools will be called for (forwarded as headers). */
    context?: McpConversationContext
  }): Promise<McpSession> {
    let client: MCPClient | undefined
    try {
      const headers = buildMcpRequestHeaders({
        apiKey: config.apiKey,
        staticHeaders: config.headers,
        context: config.context,
      })
      client = await createMCPClient({
        transport: {
          type: "http",
          url: config.url,
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
        },
        name: "caseai-connect",
        version: "1.0.0",
        capabilities: MCP_APP_CLIENT_CAPABILITIES,
      })

      const tools = (await client.tools()) as ToolSet
      const connectedClient = client
      return {
        tools,
        close: () => connectedClient.close(),
        readResource: (uri: string) => connectedClient.readResource({ uri }),
      }
    } catch (error) {
      this.logger.error(
        `Failed to connect to MCP server at ${config.url}: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      )
      await client?.close()
      return {
        tools: {},
        close: async () => {},
        readResource: async () => {
          throw new Error("MCP client is not connected")
        },
      }
    }
  }
}
