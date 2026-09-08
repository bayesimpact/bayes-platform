import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppDispatch } from "@/common/store/hooks"
import { takePendingMcpOauthContext } from "@/studio/features/mcp-servers/mcp-oauth-storage"
import { completeMcpServerOauth } from "@/studio/features/mcp-servers/mcp-servers.thunks"
import { StudioRoutes } from "@/studio/routes/helpers"

export function McpOauthCallbackRoute() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    // One-shot: the code is single-use, StrictMode double-mount must not re-run it.
    if (startedRef.current) return
    startedRef.current = true

    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const providerError = searchParams.get("error")
    const context = takePendingMcpOauthContext()

    if (providerError) {
      setError(t("mcpServers:oauthCallback.denied"))
      return
    }
    if (!code || !state || !context) {
      setError(t("mcpServers:oauthCallback.missingContext"))
      return
    }

    dispatch(completeMcpServerOauth({ ...context, code, state }))
      .unwrap()
      .then(() =>
        navigate(
          StudioRoutes.mcpServers.build({
            organizationId: context.organizationId,
            projectId: context.projectId,
          }),
          { replace: true },
        ),
      )
      .catch(() => setError(t("mcpServers:oauthCallback.failed")))
  }, [dispatch, navigate, searchParams, t])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-lg font-medium">{t("mcpServers:oauthCallback.errorTitle")}</p>
        <p className="text-muted-foreground">{error}</p>
      </div>
    )
  }
  return <LoadingRoute />
}
