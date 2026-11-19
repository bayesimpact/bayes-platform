import { type McpAppCsp, type McpAppMount, mountMcpApp } from "@caseai-connect/mcp-app-host"
import { useLingui } from "@lingui/react/macro"
import { type RefObject, useEffect, useEffectEvent, useRef, useState } from "react"
import { appConfig } from "@/app/config"
import type { ChatMcpApp } from "../chat-messages"

/** How the Desk names itself to an app, at the handshake. */
const HOST_INFO = { name: "caseai-connect-desk", version: "1.0.0" }

export type McpAppStatus = "loading" | "ready" | "failed"

type UseMcpAppOptions = {
  app: ChatMcpApp
  html: string
  /** The domains the app declares, for its Content Security Policy. */
  csp?: McpAppCsp
  /** The MCP server the app comes from, which names the origin of its sandbox. */
  mcpServerId?: string
  /** Puts a text the app proposes in the message box, which the person then sends or not. */
  onMessage: (text: string) => void
  /** Called once when the app cannot render. */
  onFailed: () => void
}

/**
 * Runs an MCP App in the sandbox of a frame, through the host all the platform's apps share
 * (`@caseai-connect/mcp-app-host`): the handshake, the tool's input and result, the app's height,
 * and the links and messages it asks for. The frame talks to the browser outside React, which an
 * effect is for. The card is keyed by its tool call, so the app restarts only for new HTML,
 * new declared domains or another server. The app gets the person's language in its host context, and follows it
 * when they pick another one.
 */
export function useMcpApp(
  frameRef: RefObject<HTMLIFrameElement | null>,
  { app, html, csp, mcpServerId, onMessage, onFailed }: UseMcpAppOptions,
): McpAppStatus {
  const [status, setStatus] = useState<McpAppStatus>("loading")
  const { i18n } = useLingui()
  const { locale } = i18n
  // The running app, which a change of language reaches without a restart.
  const mountRef = useRef<McpAppMount | null>(null)
  const readLocale = useEffectEvent(() => locale)
  // Effect events: the messages refetch into new objects, and a new handler or a refetched app
  // must not restart the app.
  const handleMessage = useEffectEvent((text: string) => onMessage(text))
  const handleFailed = useEffectEvent(() => onFailed())
  const readToolData = useEffectEvent(() => ({ input: app.toolInput, result: app.toolResult }))

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const mounted = mountMcpApp(frame, {
      html,
      csp,
      sandbox: { template: appConfig.mcpAppSandboxOrigin, key: mcpServerId },
      hostInfo: HOST_INFO,
      locale: readLocale(),
      getToolData: () => readToolData(),
      onMessage: (text) => handleMessage(text),
      onReady: () => setStatus("ready"),
      onFailed: (error) => {
        console.error("An MCP App could not render:", error)
        setStatus("failed")
        handleFailed()
      },
    })
    mountRef.current = mounted

    return () => {
      if (mountRef.current === mounted) mountRef.current = null
      mounted.unmount()
    }
  }, [frameRef, html, csp, mcpServerId])

  // The language lives in React, the app in its frame: an effect tells the app of a new one.
  useEffect(() => {
    mountRef.current?.setLocale(locale)
  }, [locale])

  return status
}
