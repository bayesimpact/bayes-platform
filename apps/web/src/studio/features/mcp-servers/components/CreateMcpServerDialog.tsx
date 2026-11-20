import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { useTranslation } from "react-i18next"
import type { CreateMcpServerFields } from "../mcp-servers.spi"
import { McpServerForm, type McpServerFormDefaults } from "./McpServerForm"
import type { McpServerFormValues } from "./mcp-server-form.schema"

const NEW_SERVER_DEFAULTS: McpServerFormDefaults = {
  name: "",
  url: "",
  authMethod: "apiKey",
  storedHeaderNames: [],
  hasStoredApiKey: false,
  hasOauthAuthorization: false,
}

export function CreateMcpServerDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (fields: CreateMcpServerFields) => void
}) {
  const { t } = useTranslation()

  const handleSubmit = (values: McpServerFormValues) => {
    // A new server stores nothing yet, so no header can ask to keep its value.
    const headers = Object.fromEntries(
      Object.entries(values.headers ?? {}).flatMap(([name, value]) =>
        value === null ? [] : [[name, value]],
      ),
    )
    onSubmit({
      name: values.name,
      url: values.url,
      authMethod: values.authMethod,
      // The API only keeps the key for the apiKey method, but drop it here too so
      // a key typed then switched away from never leaves the browser.
      apiKey: values.authMethod === "apiKey" ? values.apiKey : undefined,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("mcpServers:create.title")}</DialogTitle>
          <DialogDescription>{t("mcpServers:create.description")}</DialogDescription>
        </DialogHeader>
        {/* Mounted with the dialog, so each opening starts from an empty form. */}
        {open && (
          <McpServerForm
            defaults={NEW_SERVER_DEFAULTS}
            submitLabel={t("actions:create")}
            requiresChange={false}
            onSubmit={handleSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
