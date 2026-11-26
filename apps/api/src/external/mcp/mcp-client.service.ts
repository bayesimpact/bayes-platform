import { createMCPClient, type MCPClient } from "@ai-sdk/mcp"
import type { McpServerConnectionErrorDto, McpServerToolDto } from "@bayes-platform/api-contracts"
import { Injectable, Logger } from "@nestjs/common"
import type { ToolSet } from "ai"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { GoogleIdTokenService } from "@/external/google-iam"
import {
  buildMcpRequestHeaders,
  type McpConversationContext,
} from "@/external/mcp/mcp-request-headers"
import { MCP_APP_MIME_TYPE } from "./mcp-app-resource"
import { describeMcpConnectionError, McpConnectionTimeoutError } from "./mcp-connection-error"

const MCP_APP_CLIENT_CAPABILITIES = {
  extensions: {
    "io.modelcontextprotocol/ui": {
      mimeTypes: [MCP_APP_MIME_TYPE],
    },
  },
}

/** A configuration page waits on this call, so it gives up well before the HTTP request does. */
const INSPECTION_TIMEOUT_MS = 10_000

export type McpResourceReadResult = Awaited<ReturnType<MCPClient["readResource"]>>

export type McpConnectionConfig = {
  url: string
  apiKey?: string
  /** Static headers from the server's configuration. */
  headers?: Record<string, string>
  /** Conversation the tools will be called for (forwarded as headers). */
  context?: McpConversationContext
  /**
   * Root URL of an IAM-protected server (Cloud Run invoker): a freshly
   * minted Google ID token is sent instead of a static API key.
   */
  googleIamAudience?: string
  /** A redirect fails the request unless this is true (servers the platform runs itself). */
  followRedirects?: boolean
}

export type McpInspection =
  | { isConnected: true; tools: McpServerToolDto[] }
  | { isConnected: false; error: McpServerConnectionErrorDto }

export type McpSession = {
  tools: ToolSet
  close: () => Promise<void>
  readResource: (uri: string) => Promise<McpResourceReadResult>
}

@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name)

  constructor(private readonly googleIdTokenService: GoogleIdTokenService) {}

  async connect(config: McpConnectionConfig): Promise<McpSession> {
    let client: MCPClient | undefined
    try {
      client = await this.openClient(config)

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

  /**
   * Connects once to tell whether the server answers and which tools it
   * exposes. Unlike `connect`, a failure is returned to the caller, who is
   * someone configuring the server and needs to know why.
   */
  async inspect(config: McpConnectionConfig): Promise<McpInspection> {
    const opening = this.openClient(config)
    let timer: NodeJS.Timeout | undefined
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new McpConnectionTimeoutError(INSPECTION_TIMEOUT_MS)),
          INSPECTION_TIMEOUT_MS,
        )
      })
      const listTools = async () => (await opening).listTools()
      const { tools } = await Promise.race([listTools(), timeout])
      return {
        isConnected: true,
        tools: tools.map((tool) => ({ name: tool.name, description: tool.description ?? null })),
      }
    } catch (error) {
      const described = describeMcpConnectionError(error)
      this.logger.warn(
        `MCP server inspection failed at ${config.url}: ${described.code} (${described.detail})`,
      )
      return { isConnected: false, error: described }
    } finally {
      clearTimeout(timer)
      // Not awaited: after a timeout the client may still be opening, and the
      // caller should not wait for it. It is closed whenever it gets there.
      opening.then((client) => client.close()).catch(() => {})
    }
  }

  private async openClient(config: McpConnectionConfig): Promise<MCPClient> {
    const headers = buildMcpRequestHeaders({
      apiKey: config.apiKey,
      staticHeaders: config.headers,
      context: config.context,
    })
    if (config.googleIamAudience) {
      headers.Authorization = await this.googleIdTokenService.getAuthorizationHeader(
        config.googleIamAudience,
      )
    }
    return createMCPClient({
      transport: {
        type: "http",
        url: config.url,
        redirect: config.followRedirects ? "follow" : "error",
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      },
      name: "bayes-platform",
      version: "1.0.0",
      capabilities: MCP_APP_CLIENT_CAPABILITIES,
    })
  }
}
