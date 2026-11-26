import { MCP_APP_FRAME_SANDBOX, type McpAppCsp } from "@bayes-platform/mcp-app-host"
import { useLingui } from "@lingui/react/macro"
import { useRef } from "react"
import type { ChatMcpApp } from "../chat-messages"
import { useMcpApp } from "../hooks/use-mcp-app"
import { McpAppPlaceholder } from "./McpAppPlaceholder"

export type McpAppCardProps = {
  app: ChatMcpApp
  html: string
  /** The domains the app declares. Without any, it runs with no network and no frame. */
  csp?: McpAppCsp
  /** The MCP server the app comes from, which names the origin of its sandbox. */
  mcpServerId: string
  onMessage: (text: string) => void
  /** Called once when the app cannot render, so the reply shows the tool's text instead. */
  onFailed: (toolCallId: string) => void
}

/**
 * The interactive card of an MCP App, sandboxed away from the Desk. A placeholder covers it until
 * the app is ready; the frame keeps its width meanwhile, so the app measures a real one.
 */
export function McpAppCard({ app, html, csp, mcpServerId, onMessage, onFailed }: McpAppCardProps) {
  const { t } = useLingui()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const status = useMcpApp(frameRef, {
    app,
    html,
    csp,
    mcpServerId,
    onMessage,
    onFailed: () => onFailed(app.toolCallId),
  })
  if (status === "failed") return null

  return (
    <div className="relative w-full overflow-hidden rounded-xl border">
      <iframe
        ref={frameRef}
        title={t`Interactive card`}
        sandbox={MCP_APP_FRAME_SANDBOX}
        className={status === "ready" ? "block h-18 w-full" : "invisible block h-18 w-full"}
      />
      {status === "loading" ? <McpAppPlaceholder /> : null}
    </div>
  )
}
