import {
  MCP_APP_FRAME_SANDBOX,
  type McpAppCsp,
  type McpAppMount,
  mountMcpApp,
} from "@caseai-connect/mcp-app-host"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { MCP_APP_SANDBOX_ORIGIN } from "../../api/api-base"
import { cn } from "../lib/cn"
import { Spinner } from "./Spinner"

const HOST_INFO = { name: "caseai-connect", version: "1.0.0" }
const INITIAL_IFRAME_HEIGHT_PX = 72

/**
 * Holds a card's place while it cannot show yet: its HTML is still being read from the MCP
 * server, or the iframe has not finished its handshake. Sized like the empty iframe so the
 * reply does not jump when the card takes over.
 */
export function McpAppPlaceholder({ className }: { className?: string }) {
  const { t } = useTranslation("chat")
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex w-full items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-4 text-gray-500 text-sm",
        className,
      )}
      style={{ minHeight: INITIAL_IFRAME_HEIGHT_PX }}
    >
      <Spinner />
      <span className="animate-pulse">{t("message.loadingCard")}</span>
    </div>
  )
}

/**
 * An MCP App card, run in the sandbox every app of the platform shares
 * (`@caseai-connect/mcp-app-host`): this component renders the frame, and the shared host does
 * the handshake, hands the app its tool data and answers what it asks for. The widget takes no
 * message from an app, which the app learns at the handshake.
 */
export function McpAppView({
  html,
  csp,
  mcpServerId,
  toolInput,
  toolResult,
  onRenderFailed,
}: {
  html: string
  /** The domains the card declares. Without any, it runs with no network and no frame. */
  csp?: McpAppCsp
  /** The MCP server the card comes from, which names the origin of its sandbox. */
  mcpServerId?: string
  toolInput: unknown
  toolResult: unknown
  /** The card gave up (handshake error or timeout); the parent can show its text fallback. */
  onRenderFailed?: () => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // The card speaks the widget's language: sent at the handshake, then on every language
  // change through host-context-changed, so switching language does not reload the card.
  const { i18n } = useTranslation()
  const locale = i18n.language
  const localeRef = useRef(locale)
  const mountRef = useRef<McpAppMount | null>(null)
  const [hasFailed, setHasFailed] = useState(false)
  // The guest completed `ui/initialize`: until then the frame is blank and a placeholder covers it.
  const [isInitialized, setIsInitialized] = useState(false)
  // Parents pass an inline arrow that changes identity when any sibling card
  // fails. Reading it through a ref keeps it out of the render effect deps, so
  // a sibling failure does not tear down and re-handshake this card.
  const onRenderFailedRef = useRef(onRenderFailed)
  useEffect(() => {
    onRenderFailedRef.current = onRenderFailed
  })

  useEffect(() => {
    localeRef.current = locale
    mountRef.current?.setLocale(locale)
  }, [locale])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    setIsInitialized(false)
    const mounted = mountMcpApp(iframe, {
      html,
      csp,
      sandbox: { template: MCP_APP_SANDBOX_ORIGIN, key: mcpServerId },
      hostInfo: HOST_INFO,
      locale: localeRef.current,
      getToolData: () => ({ input: toolInput, result: toolResult }),
      onReady: () => setIsInitialized(true),
      onFailed: (error) => {
        console.warn(
          "MCP App render failed",
          error instanceof Error ? error.message : "unknown error",
        )
        setHasFailed(true)
        onRenderFailedRef.current?.()
      },
    })
    mountRef.current = mounted

    return () => {
      if (mountRef.current === mounted) mountRef.current = null
      mounted.unmount()
    }
  }, [html, csp, mcpServerId, toolInput, toolResult])

  if (hasFailed) return null

  // The frame stays laid out (not hidden) while it initializes so the guest measures a real
  // width and reports a usable height; the placeholder simply covers it until then.
  return (
    <div className="relative mt-2">
      {!isInitialized && <McpAppPlaceholder className="absolute inset-0" />}
      <iframe
        ref={iframeRef}
        className={cn(
          "block w-full overflow-hidden rounded-md border border-gray-200 bg-white",
          !isInitialized && "invisible",
        )}
        sandbox={MCP_APP_FRAME_SANDBOX}
        style={{ height: INITIAL_IFRAME_HEIGHT_PX, border: 0 }}
        title="MCP App"
      />
    </div>
  )
}
