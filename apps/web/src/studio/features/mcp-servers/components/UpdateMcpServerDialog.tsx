import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { useTranslation } from "react-i18next"
import type { UpdateMcpServerFields } from "../mcp-servers.spi"
import { McpServerForm } from "./McpServerForm"
import type { McpServerFormValues } from "./mcp-server-form.schema"
import type { McpServerDisplay } from "./mcp-servers.types"

export function UpdateMcpServerDialog({
  mcpServer,
  open,
  onOpenChange,
  onSubmit,
}: {
  mcpServer: McpServerDisplay
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (mcpServerId: string, fields: UpdateMcpServerFields) => void
}) {
  const { t } = useTranslation()

  const handleSubmit = (values: McpServerFormValues) => {
    onSubmit(mcpServer.id, {
      name: values.name,
      url: values.url,
      authMethod: values.authMethod,
      // An empty key keeps the stored one. A key typed then switched away from
      // never leaves the browser.
      apiKey: values.authMethod === "apiKey" && values.apiKey ? values.apiKey : undefined,
      headers: values.headers,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("mcpServers:update.title")}</DialogTitle>
          <DialogDescription>{t("mcpServers:update.description")}</DialogDescription>
        </DialogHeader>
        {/* Mounted with the dialog, so each opening starts from the saved server. */}
        {open && (
          <McpServerForm
            defaults={{
              name: mcpServer.name,
              url: mcpServer.url,
              authMethod: mcpServer.authMethod,
              storedHeaderNames: mcpServer.headerNames,
              hasStoredApiKey: mcpServer.authStatus === "apiKey",
              hasOauthAuthorization:
                mcpServer.authStatus === "oauthConnected" ||
                mcpServer.authStatus === "oauthExpired",
            }}
            submitLabel={t("actions:save")}
            requiresChange
            onSubmit={handleSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
