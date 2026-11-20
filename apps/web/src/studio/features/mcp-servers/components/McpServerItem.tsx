import { Button } from "@caseai-connect/ui/shad/button"
import { PencilIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { GridCard } from "@/common/components/grid/Grid"
import type { McpServerConnection } from "../mcp-servers.models"
import type { UpdateMcpServerFields } from "../mcp-servers.spi"
import {
  McpServerConnectionBadge,
  McpServerConnectionError,
  needsOauthAuthorization,
} from "./McpServerConnectionStatus"
import { McpServerToolsDialog } from "./McpServerToolsDialog"
import type { McpServerDisplay } from "./mcp-servers.types"
import { UpdateMcpServerDialog } from "./UpdateMcpServerDialog"

export function McpServerItem({
  mcpServer,
  connection,
  onDelete,
  onUpdate,
  onInspect,
  onAuthorize,
}: {
  mcpServer: McpServerDisplay
  connection: McpServerConnection
  onDelete: (id: string) => void
  onUpdate: (id: string, fields: UpdateMcpServerFields) => void
  /** Connects to the server again and refreshes its status and tools. */
  onInspect: (id: string) => void
  onAuthorize: (id: string) => void
}) {
  const { t } = useTranslation()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isShowingTools, setIsShowingTools] = useState(false)

  const isChecking =
    connection.state === "checking" || (connection.state === "checked" && connection.isRefreshing)
  const tools =
    connection.state === "checked" && connection.inspection.status === "connected"
      ? connection.inspection.tools
      : null
  const needsAuthorization = needsOauthAuthorization(mcpServer.authStatus)

  return (
    <>
      <GridCard className="justify-start">
        <GridCard.TopAction>
          {!needsAuthorization && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("mcpServers:actions.testConnection")}
              title={t("mcpServers:actions.testConnection")}
              disabled={isChecking}
              onClick={() => onInspect(mcpServer.id)}
            >
              <RefreshCwIcon className="size-3.5" />
            </Button>
          )}
          {!mcpServer.isBuiltIn && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("actions:edit")}
                title={t("actions:edit")}
                onClick={() => setIsEditing(true)}
              >
                <PencilIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("actions:delete")}
                title={t("actions:delete")}
                onClick={() => setIsConfirmingDelete(true)}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </>
          )}
        </GridCard.TopAction>
        {mcpServer.isBuiltIn && <GridCard.Badge>{t("mcpServers:builtIn")}</GridCard.Badge>}
        <GridCard.Body>
          {/* Room for the three actions of the top-right corner. */}
          <GridCard.Title className="pr-24">{mcpServer.name}</GridCard.Title>
          {!mcpServer.isBuiltIn && (
            <p className="mt-1 truncate text-base leading-snug text-muted-foreground">
              {mcpServer.url}
            </p>
          )}
          <div className="mt-3 flex min-h-8 flex-wrap items-center gap-2">
            <McpServerConnectionBadge connection={connection} authStatus={mcpServer.authStatus} />
            {tools && !needsAuthorization && (
              <Button
                variant="link"
                size="sm"
                className="px-0"
                onClick={() => setIsShowingTools(true)}
              >
                {t("mcpServers:tools.count", { count: tools.length })}
              </Button>
            )}
            {needsAuthorization && (
              <Button variant="outline" size="sm" onClick={() => onAuthorize(mcpServer.id)}>
                {mcpServer.authStatus === "oauthExpired"
                  ? t("mcpServers:oauth.reauthorize")
                  : t("mcpServers:oauth.authorize")}
              </Button>
            )}
          </div>
          {mcpServer.authStatus === "oauthExpired" && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("mcpServers:oauth.expiredHint")}
            </p>
          )}
          {!needsAuthorization && (
            <McpServerConnectionError connection={connection} className="mt-2" />
          )}
        </GridCard.Body>
      </GridCard>

      <McpServerToolsDialog
        serverName={mcpServer.name}
        authStatus={mcpServer.authStatus}
        connection={connection}
        open={isShowingTools}
        onOpenChange={setIsShowingTools}
        onRefresh={() => onInspect(mcpServer.id)}
      />

      {!mcpServer.isBuiltIn && (
        <UpdateMcpServerDialog
          mcpServer={mcpServer}
          open={isEditing}
          onOpenChange={setIsEditing}
          onSubmit={onUpdate}
        />
      )}

      <ConfirmDialog
        open={isConfirmingDelete}
        title={t("mcpServers:delete.title")}
        description={t("mcpServers:delete.description", { name: mcpServer.name })}
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={() => {
          onDelete(mcpServer.id)
          setIsConfirmingDelete(false)
        }}
      />
    </>
  )
}
