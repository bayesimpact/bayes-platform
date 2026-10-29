import type { McpAppCspDto } from "@caseai-connect/api-contracts"
import { MCP_APP_SANDBOX, mountMcpApp } from "@caseai-connect/mcp-app-host"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { cn } from "@caseai-connect/ui/utils"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

const INITIAL_IFRAME_HEIGHT_PX = 72

/**
 * Holds a card's place while it cannot show yet: its HTML is still being read from the MCP
 * server, or the iframe has not finished its handshake. Sized like the empty iframe so the
 * reply does not jump when the card takes over.
 */
export function McpAppPlaceholder({ className }: { className?: string }) {
  const { t } = useTranslation("agentSessionMessage")
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex w-full items-center gap-2 rounded-md border bg-muted/40 px-4 text-sm text-muted-foreground",
        className,
      )}
      style={{ minHeight: INITIAL_IFRAME_HEIGHT_PX }}
    >
      <Spinner />
      <span className="animate-pulse">{t("mcpApp.loading")}</span>
    </div>
  )
}

/**
 * An MCP App card: a double iframe whose inner frame runs the app under a Content Security
 * Policy built from the domains it declares (`mountMcpApp`). Still a POC host: the outer frame
 * is a `srcdoc`, not a sandbox origin of its own.
 */
export function McpAppView({
  html,
  csp,
  toolInput,
  toolResult,
  onMessage,
  onRenderFailed,
}: {
  html: string
  /** The domains the app declares. Absent, the strictest policy applies. */
  csp?: McpAppCspDto
  toolInput: unknown
  toolResult: unknown
  /**
   * Puts a message the app proposes (`ui/message`) in the chat input, for the user to read and
   * send. Without it the app is told the host takes no messages, and offers its own fallback.
   */
  onMessage?: (text: string) => void
  /** The card gave up (handshake error or timeout); the parent can show its text fallback. */
  onRenderFailed?: () => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [hasFailed, setHasFailed] = useState(false)
  // The guest completed `ui/initialize`: until then the frame is blank and a placeholder covers it.
  const [isInitialized, setIsInitialized] = useState(false)
  // Parents pass inline arrows that change identity when any sibling card
  // fails. Reading them through refs keeps them out of the render effect deps,
  // so a sibling failure does not tear down and re-handshake this card.
  const onRenderFailedRef = useRef(onRenderFailed)
  const onMessageRef = useRef(onMessage)
  useEffect(() => {
    onRenderFailedRef.current = onRenderFailed
    onMessageRef.current = onMessage
  })

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    setIsInitialized(false)
    return mountMcpApp(iframe, {
      html,
      csp,
      toolInput,
      toolResult,
      getMessageHandler: () => onMessageRef.current,
      onInitialized: () => setIsInitialized(true),
      onRenderFailed: () => {
        setHasFailed(true)
        onRenderFailedRef.current?.()
      },
    })
  }, [html, csp, toolInput, toolResult])

  if (hasFailed) return null

  // The frame stays laid out (not hidden) while it initializes so the guest measures a real
  // width and reports a usable height; the placeholder simply covers it until then.
  return (
    <div className="relative mt-2">
      {!isInitialized && <McpAppPlaceholder className="absolute inset-0" />}
      <iframe
        ref={iframeRef}
        className={cn(
          "block w-full overflow-hidden rounded-md border bg-background",
          !isInitialized && "invisible",
        )}
        sandbox={MCP_APP_SANDBOX}
        style={{ height: INITIAL_IFRAME_HEIGHT_PX, border: 0 }}
        title="MCP App"
      />
    </div>
  )
}
