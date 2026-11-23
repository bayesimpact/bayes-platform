import type {
  McpServerAuthStatus,
  McpServerConnectionErrorCode,
} from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { useTranslation } from "react-i18next"
import type { McpServerConnection } from "../mcp-servers.models"

const ERROR_MESSAGE_KEYS = {
  unauthorized: "mcpServers:connection.errors.unauthorized",
  forbidden: "mcpServers:connection.errors.forbidden",
  notFound: "mcpServers:connection.errors.notFound",
  httpError: "mcpServers:connection.errors.httpError",
  unreachable: "mcpServers:connection.errors.unreachable",
  timeout: "mcpServers:connection.errors.timeout",
  notMcp: "mcpServers:connection.errors.notMcp",
  urlNotAllowed: "mcpServers:connection.errors.urlNotAllowed",
  unknown: "mcpServers:connection.errors.unknown",
} as const satisfies Record<McpServerConnectionErrorCode, string>

/** Whether the server has an OAuth authorization to give or to give again. */
export function needsOauthAuthorization(authStatus: McpServerAuthStatus): boolean {
  return authStatus === "oauthPending" || authStatus === "oauthExpired"
}

/**
 * The state of a server in one badge. What the server's own auth says comes
 * first: without an authorization there is nothing to connect with.
 */
export function McpServerConnectionBadge({
  connection,
  authStatus,
}: {
  connection: McpServerConnection
  authStatus: McpServerAuthStatus
}) {
  const { t } = useTranslation()

  if (authStatus === "oauthExpired") {
    return <Badge variant="warning">{t("mcpServers:connection.authorizationExpired")}</Badge>
  }
  if (authStatus === "oauthPending") {
    return <Badge variant="warning">{t("mcpServers:connection.authorizationRequired")}</Badge>
  }
  if (connection.state === "unknown") return null
  if (connection.state === "checking") {
    return (
      <Badge variant="secondary">
        <Spinner /> {t("mcpServers:connection.checking")}
      </Badge>
    )
  }
  if (connection.state === "unavailable") {
    return <Badge variant="secondary">{t("mcpServers:connection.unavailable")}</Badge>
  }

  const { inspection, isRefreshing } = connection
  const refreshing = isRefreshing ? <Spinner /> : null
  if (inspection.status === "connected") {
    return (
      <Badge variant="success">
        {refreshing} {t("mcpServers:connection.connected")}
      </Badge>
    )
  }
  if (inspection.status === "authorizationRequired") {
    return (
      <Badge variant="warning">
        {refreshing} {t("mcpServers:connection.authorizationRequired")}
      </Badge>
    )
  }
  return (
    <Badge variant="destructive">
      {refreshing} {t("mcpServers:connection.failed")}
    </Badge>
  )
}

/** Why the last connection failed: a sentence for the person, then what the client reported. */
export function McpServerConnectionError({
  connection,
  className,
}: {
  connection: McpServerConnection
  className?: string
}) {
  const { t } = useTranslation()
  if (connection.state !== "checked" || !connection.inspection.error) return null
  const { error } = connection.inspection

  return (
    <div className={className}>
      <p className="text-sm text-destructive">
        {t(ERROR_MESSAGE_KEYS[error.code], { status: error.httpStatus })}
      </p>
      <p className="mt-1 line-clamp-2 break-all font-mono text-xs text-muted-foreground">
        {error.detail}
      </p>
    </div>
  )
}
