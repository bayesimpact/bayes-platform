import type { McpServerAuthStatus } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { ItemGroup } from "@caseai-connect/ui/shad/item"
import { RefreshCwIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { McpServerConnection } from "../mcp-servers.models"
import { McpServerConnectionBadge, McpServerConnectionError } from "./McpServerConnectionStatus"
import { McpServerToolItem } from "./McpServerToolItem"

/**
 * What a server provides: its tools when it answers, the reason when it does
 * not. Read-only, so the agent editor opens it too.
 */
export function McpServerToolsDialog({
  serverName,
  authStatus,
  connection,
  open,
  onOpenChange,
  onRefresh,
}: {
  serverName: string
  authStatus: McpServerAuthStatus
  connection: McpServerConnection
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const isChecking =
    connection.state === "checking" || (connection.state === "checked" && connection.isRefreshing)
  const tools =
    connection.state === "checked" && connection.inspection.status === "connected"
      ? connection.inspection.tools
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("mcpServers:tools.title", { name: serverName })}</DialogTitle>
          <DialogDescription>{t("mcpServers:tools.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <McpServerConnectionBadge connection={connection} authStatus={authStatus} />
            {tools && (
              <span className="text-sm text-muted-foreground">
                {t("mcpServers:tools.count", { count: tools.length })}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" disabled={isChecking} onClick={onRefresh}>
            <RefreshCwIcon className="size-4" /> {t("actions:refresh")}
          </Button>
        </div>

        <McpServerConnectionError connection={connection} />
        {tools && tools.length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">{t("mcpServers:tools.empty")}</p>
        )}
        {tools && tools.length > 0 && (
          <ItemGroup className="max-h-96 gap-2 overflow-y-auto">
            {tools.map((tool) => (
              <McpServerToolItem key={tool.name} tool={tool} />
            ))}
          </ItemGroup>
        )}
      </DialogContent>
    </Dialog>
  )
}
