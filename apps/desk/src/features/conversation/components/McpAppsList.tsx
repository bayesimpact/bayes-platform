import type { ChatMcpApp } from "../chat-messages"
import { type AppsHtml, findMcpAppHtml } from "../mcp-apps"
import { McpAppCard } from "./McpAppCard"
import { McpAppPlaceholder } from "./McpAppPlaceholder"

export type McpAppsListProps = {
  apps: ChatMcpApp[]
  appsHtml: AppsHtml
  failedAppIds: string[]
  onAppMessage: (text: string) => void
  onAppFailed: (toolCallId: string) => void
}

/**
 * The MCP App cards of a reply, in the order of its tool calls: a placeholder while their HTML
 * loads, nothing for an app with no HTML or one that failed.
 */
export function McpAppsList({
  apps,
  appsHtml,
  failedAppIds,
  onAppMessage,
  onAppFailed,
}: McpAppsListProps) {
  return (
    <div className="flex flex-col gap-3 empty:hidden">
      {apps.map((app) => {
        if (failedAppIds.includes(app.toolCallId)) return null
        const html = findMcpAppHtml(app, appsHtml.htmls)
        if (html !== null) {
          return (
            <McpAppCard
              key={app.toolCallId}
              app={app}
              html={html}
              onMessage={onAppMessage}
              onFailed={onAppFailed}
            />
          )
        }
        return appsHtml.isPending ? (
          <div key={app.toolCallId} className="relative min-h-18">
            <McpAppPlaceholder />
          </div>
        ) : null
      })}
    </div>
  )
}
