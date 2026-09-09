import { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import type { JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "../lib/cn"
import { isOpenableLink } from "./mcp-app-view"
import { Spinner } from "./Spinner"

const HOST_INFO = { name: "caseai-connect", version: "1.0.0" }
const INITIALIZE_TIMEOUT_MS = 15_000
const INITIAL_IFRAME_HEIGHT_PX = 72
const SANDBOX_RPC_TYPE = "caseai/sandbox-rpc"
const BOOTSTRAP_READY_METHOD = "caseai/sandbox-bootstrap-ready"
const SANDBOX_ID_PLACEHOLDER = "__SANDBOX_ID__"
const TOOL_RESULT_RETRY_DELAYS_MS = [50, 250] as const

/**
 * Outer proxy (unique origin vs the host). It creates an inner iframe and
 * loads the MCP App from a blob URL so Tailwind v4 `@layer` CSS parses as a
 * normal document. `document.write` into the srcdoc iframe left utilities
 * unapplied even though the stylesheet was in the DOM.
 *
 * Inner `allow-same-origin` is same-origin with this proxy only, not the host.
 *
 * RPC is wrapped with a sandbox id so two cards on the same page do not share
 * JSON-RPC over `window`. Unique-origin `event.source === contentWindow` is
 * not reliable, so PostMessageTransport would mix or drop replies at random.
 *
 * Both frames also carry `allow-popups allow-popups-to-escape-sandbox
 * allow-downloads`: a nested frame inherits the parent's sandbox restrictions,
 * so the flags have to be present on the outer and inner iframe for a guest's
 * own `<a target="_blank">` or `window.open` to do anything. The escape flag
 * makes the opened tab a normal top-level page (not itself sandboxed), and
 * `allow-downloads` is what lets that tab actually save a file: browsers judge
 * a download by the frame that started the navigation, so without it the tab
 * opens on the signed URL and nothing happens.
 *
 * Two paths can open a tab and both are gated. A guest anchor navigates
 * natively, which the browser only allows from a real user gesture inside the
 * sandboxed guest. The spec-compliant `ui/open-link` fallback below is gated
 * on the browser's own transient activation check and severs `opener` on the
 * tab it opens, so either way the new tab carries the same power as a plain
 * link in a markdown reply.
 */
const SANDBOX_BOOTSTRAP_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; }
      body { display: flex; flex-direction: column; }
      iframe { border: 0; flex: 1; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <script>
      (function () {
        var sandboxId = "${SANDBOX_ID_PLACEHOLDER}"
        var inner = document.createElement("iframe")
        inner.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads")
        inner.setAttribute("title", "MCP App view")
        document.body.appendChild(inner)

        window.addEventListener("message", function (event) {
          if (event.source === window.parent) {
            var data = event.data
            var rpc = data && data.type === "${SANDBOX_RPC_TYPE}" ? data.message : data
            if (rpc && rpc.method === "ui/notifications/sandbox-resource-ready") {
              var html = rpc.params && rpc.params.html
              if (typeof html === "string") {
                var blob = new Blob([html], { type: "text/html" })
                inner.src = URL.createObjectURL(blob)
              }
              return
            }
            if (inner.contentWindow) inner.contentWindow.postMessage(rpc, "*")
            return
          }
          if (inner.contentWindow && event.source === inner.contentWindow) {
            window.parent.postMessage({
              type: "${SANDBOX_RPC_TYPE}",
              sandboxId: sandboxId,
              message: event.data
            }, "*")
          }
        })
        window.parent.postMessage({ method: "${BOOTSTRAP_READY_METHOD}", sandboxId: sandboxId }, "*")
      })()
    </script>
  </body>
</html>`

function toToolResult(result: unknown): Parameters<AppBridge["sendToolResult"]>[0] {
  if (result && typeof result === "object" && "content" in result) {
    return result as Parameters<AppBridge["sendToolResult"]>[0]
  }

  return {
    content: [{ type: "text", text: "" }],
    structuredContent:
      result && typeof result === "object"
        ? (result as Record<string, unknown>)
        : { value: result },
  }
}

type SandboxRpcEnvelope = {
  type: typeof SANDBOX_RPC_TYPE
  sandboxId: string
  message: unknown
}

function isSandboxRpcEnvelope(data: unknown): data is SandboxRpcEnvelope {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === SANDBOX_RPC_TYPE &&
    "sandboxId" in data &&
    typeof data.sandboxId === "string" &&
    "message" in data
  )
}

/**
 * Like PostMessageTransport, but routes by sandbox id instead of WindowProxy
 * identity. Two unique-origin iframes otherwise collide on the host `window`.
 */
class SandboxedPostMessageTransport implements Transport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void

  private readonly listener: (event: MessageEvent) => void

  constructor(
    private readonly eventTarget: Window,
    private readonly sandboxId: string,
  ) {
    this.listener = (event: MessageEvent) => {
      if (!isSandboxRpcEnvelope(event.data) || event.data.sandboxId !== this.sandboxId) {
        return
      }
      this.onmessage?.(event.data.message as JSONRPCMessage)
    }
  }

  async start() {
    window.addEventListener("message", this.listener)
  }

  async send(message: JSONRPCMessage) {
    this.eventTarget.postMessage(
      { type: SANDBOX_RPC_TYPE, sandboxId: this.sandboxId, message },
      "*",
    )
  }

  async close() {
    window.removeEventListener("message", this.listener)
    this.onclose?.()
  }
}

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
 * POC host: double iframe without a second domain.
 * Outer frame is sandboxed unique-origin; inner frame loads the MCP App HTML.
 */
export function McpAppView({
  html,
  toolInput,
  toolResult,
  onRenderFailed,
}: {
  html: string
  toolInput: unknown
  toolResult: unknown
  /** The card gave up (handshake error or timeout); the parent can show its text fallback. */
  onRenderFailed?: () => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
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
    const iframe = iframeRef.current
    if (!iframe) return

    setIsInitialized(false)
    const sandboxId = crypto.randomUUID()
    let cancelled = false
    let attempt = 0
    let started = false
    let bridge: AppBridge | undefined
    const retryTimeoutIds: number[] = []

    const start = async () => {
      const thisAttempt = ++attempt
      if (cancelled || !iframe.contentWindow) return

      try {
        const appBridge = new AppBridge(
          null,
          HOST_INFO,
          { logging: {}, sandbox: {}, openLinks: {} },
          {
            // The app has no dark mode, so guests are told to render light.
            hostContext: { displayMode: "inline", platform: "web", theme: "light" },
          },
        )
        bridge = appBridge

        const pushToolData = async () => {
          if (cancelled || thisAttempt !== attempt) return
          await appBridge.sendToolInput({
            arguments: (toolInput ?? {}) as Record<string, unknown>,
          })
          await appBridge.sendToolResult(toToolResult(toolResult))
        }

        let resendOnNextSizeChange = false
        appBridge.onsizechange = ({ height }) => {
          if (typeof height === "number" && height > 0) {
            iframe.style.height = `${Math.ceil(height)}px`
          }
          if (resendOnNextSizeChange) {
            resendOnNextSizeChange = false
            void pushToolData()
          }
        }
        appBridge.onopenlink = async ({ url }) => {
          if (!isOpenableLink(url)) return { isError: true }
          if (navigator.userActivation?.isActive === false) return { isError: true }
          const opened = window.open(url, "_blank")
          if (!opened) return { isError: true }
          opened.opener = null
          return {}
        }

        const initialized = new Promise<void>((resolve, reject) => {
          const timeoutId = window.setTimeout(() => {
            reject(new Error("MCP App initialization timed out"))
          }, INITIALIZE_TIMEOUT_MS)
          appBridge.oninitialized = () => {
            window.clearTimeout(timeoutId)
            resolve()
          }
        })

        await appBridge.connect(new SandboxedPostMessageTransport(iframe.contentWindow, sandboxId))
        if (thisAttempt !== attempt || cancelled) {
          void appBridge.close()
          return
        }
        await appBridge.sendSandboxResourceReady({
          html: html.replace(/<\/iframe/gi, "<\\/iframe"),
        })
        await initialized
        if (thisAttempt !== attempt || cancelled) return

        setIsInitialized(true)
        // Apps often register `ontoolresult` after `connect()`, so the first
        // notification is dropped and the UI stays on its loading shell.
        resendOnNextSizeChange = true
        await pushToolData()
        if (thisAttempt !== attempt || cancelled) return
        for (const delayMs of TOOL_RESULT_RETRY_DELAYS_MS) {
          retryTimeoutIds.push(window.setTimeout(() => void pushToolData(), delayMs))
        }
      } catch (error) {
        if (thisAttempt !== attempt || cancelled) return
        console.warn(
          "MCP App render failed",
          error instanceof Error ? error.message : "unknown error",
        )
        setHasFailed(true)
        onRenderFailedRef.current?.()
      }
    }

    const handleMessage = (event: MessageEvent) => {
      const data = event.data
      if (
        typeof data !== "object" ||
        data === null ||
        !("method" in data) ||
        data.method !== BOOTSTRAP_READY_METHOD ||
        !("sandboxId" in data) ||
        data.sandboxId !== sandboxId
      ) {
        return
      }
      if (started) return
      started = true
      void start()
    }

    // Wait for the bootstrap ping, not `load`. A dynamically inserted iframe
    // fires `load` for about:blank first; starting then leaves an empty frame
    // until the 15s init timeout hides it. Reload works because that blank
    // load often does not happen on first paint.
    window.addEventListener("message", handleMessage)
    iframe.srcdoc = SANDBOX_BOOTSTRAP_HTML.replaceAll(SANDBOX_ID_PLACEHOLDER, sandboxId)

    return () => {
      cancelled = true
      attempt += 1
      for (const timeoutId of retryTimeoutIds) {
        window.clearTimeout(timeoutId)
      }
      window.removeEventListener("message", handleMessage)
      const currentBridge = bridge
      void currentBridge
        ?.teardownResource({})
        .catch(() => undefined)
        .finally(() => {
          void currentBridge.close()
        })
    }
  }, [html, toolInput, toolResult])

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
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads"
        style={{ height: INITIAL_IFRAME_HEIGHT_PX, border: 0 }}
        title="MCP App"
      />
    </div>
  )
}
