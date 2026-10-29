import type { McpAppCspDto } from "@caseai-connect/api-contracts"
import { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import type { JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js"
import { buildMcpAppCsp, withMcpAppCsp } from "./csp"

const HOST_INFO = { name: "caseai-connect", version: "1.0.0" }
const INITIALIZE_TIMEOUT_MS = 15_000
const SANDBOX_RPC_TYPE = "caseai/sandbox-rpc"
const BOOTSTRAP_READY_METHOD = "caseai/sandbox-bootstrap-ready"
const SANDBOX_ID_PLACEHOLDER = "__SANDBOX_ID__"
const TOOL_RESULT_RETRY_DELAYS_MS = [50, 250] as const

/**
 * Both frames carry `allow-popups allow-popups-to-escape-sandbox allow-downloads`: a nested
 * frame inherits the parent's sandbox restrictions, so the flags have to be present on the outer
 * and inner frame for a guest's own `<a target="_blank">` or `window.open` to do anything. The
 * escape flag makes the opened tab a normal top-level page (not itself sandboxed), and
 * `allow-downloads` is what lets that tab actually save a file: browsers judge a download by the
 * frame that started the navigation, so without it the tab opens on the signed URL and nothing
 * happens.
 *
 * Neither frame has `allow-same-origin`, so each has an opaque origin of its own. The app cannot
 * read or rewrite the proxy that relays its messages, nor reach the host.
 */
const POPUP_AND_DOWNLOAD_FLAGS = "allow-popups allow-popups-to-escape-sandbox allow-downloads"

/** The `sandbox` attribute of the outer frame, the one the host renders. */
export const MCP_APP_SANDBOX = `allow-scripts ${POPUP_AND_DOWNLOAD_FLAGS}`

/**
 * Outer proxy (unique origin vs the host). It creates the inner frame and loads the MCP App in
 * it through `srcdoc`, so the app parses as a normal document (Tailwind v4 `@layer` CSS
 * included) under the policy the host put at its top.
 *
 * RPC is wrapped with a sandbox id so two cards on the same page do not share JSON-RPC over
 * `window`. Unique-origin `event.source === contentWindow` is not reliable on the host, so
 * PostMessageTransport would mix or drop replies at random.
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
        inner.setAttribute("sandbox", "${MCP_APP_SANDBOX}")
        inner.setAttribute("title", "MCP App view")
        document.body.appendChild(inner)

        window.addEventListener("message", function (event) {
          if (event.source === window.parent) {
            var data = event.data
            var rpc = data && data.type === "${SANDBOX_RPC_TYPE}" ? data.message : data
            if (rpc && rpc.method === "ui/notifications/sandbox-resource-ready") {
              var html = rpc.params && rpc.params.html
              if (typeof html === "string") inner.srcdoc = html
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

/** Only `http:`/`https:` links are safe to open in a new tab from an MCP App. */
export function isOpenableLink(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Text of a message an MCP App proposes for the conversation (`ui/message`): its text blocks,
 * joined. Empty when it carries no text, since the chat input only takes text.
 */
export function getMcpAppMessageText(content: unknown[]): string {
  return content
    .flatMap((block: unknown) =>
      block &&
      typeof block === "object" &&
      "type" in block &&
      block.type === "text" &&
      "text" in block &&
      typeof block.text === "string"
        ? [block.text.trim()]
        : [],
    )
    .filter((text) => text.length > 0)
    .join("\n\n")
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

export type McpAppMountOptions = {
  html: string
  /** The domains the app declares. Absent, the strictest policy applies. */
  csp?: McpAppCspDto
  toolInput: unknown
  toolResult: unknown
  /**
   * Where a message the app proposes (`ui/message`) goes, read when the app sends one. Without
   * it at mount time the app is told the host takes no messages, and offers its own fallback.
   */
  getMessageHandler?: () => ((text: string) => void) | undefined
  /** The app finished its handshake: the card can show. */
  onInitialized: () => void
  /** The card gave up (handshake error or timeout); the caller can show its text fallback. */
  onRenderFailed: () => void
}

/**
 * Loads an MCP App in an outer frame rendered with `MCP_APP_SANDBOX`, and talks to it until the
 * returned function tears it down. The app runs under a Content Security Policy built from the
 * domains it declares.
 */
export function mountMcpApp(iframe: HTMLIFrameElement, options: McpAppMountOptions): () => void {
  const { html, csp, toolInput, toolResult, getMessageHandler, onInitialized, onRenderFailed } =
    options
  const sandboxId = crypto.randomUUID()
  const appHtml = withMcpAppCsp(html, buildMcpAppCsp(csp))
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
        {
          logging: {},
          sandbox: {},
          openLinks: {},
          ...(getMessageHandler?.() ? { message: { text: {} } } : {}),
        },
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
      // Two paths can open a tab and both are gated. A guest anchor navigates natively, which
      // the browser only allows from a real user gesture inside the sandboxed guest. This
      // `ui/open-link` fallback is gated on the browser's own transient activation check and
      // severs `opener` on the tab it opens, so either way the new tab carries the same power
      // as a plain link in a markdown reply.
      appBridge.onopenlink = async ({ url }) => {
        if (!isOpenableLink(url)) return { isError: true }
        if (navigator.userActivation?.isActive === false) return { isError: true }
        const opened = window.open(url, "_blank")
        if (!opened) return { isError: true }
        opened.opener = null
        return {}
      }
      // The message only lands in the input: the user still reads it and sends it. Like a
      // link, it needs a click or a key press in the card, so a card cannot fill the input
      // on its own.
      appBridge.onmessage = async ({ role, content }) => {
        const placeMessage = getMessageHandler?.()
        const text = getMcpAppMessageText(content)
        if (!placeMessage || role !== "user" || text.length === 0) return { isError: true }
        if (navigator.userActivation?.isActive === false) return { isError: true }
        placeMessage(text)
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
      await appBridge.sendSandboxResourceReady({ html: appHtml })
      await initialized
      if (thisAttempt !== attempt || cancelled) return

      onInitialized()
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
      onRenderFailed()
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
  // Loaded one task later, and not at all by a run torn down before then. Navigating the
  // frame twice in a row, as StrictMode's double mount in dev does, leaves its document
  // unrendered (0×0) while the handshake still succeeds: the card stays blank.
  const loadTimeoutId = window.setTimeout(() => {
    iframe.srcdoc = SANDBOX_BOOTSTRAP_HTML.replaceAll(SANDBOX_ID_PLACEHOLDER, sandboxId)
  }, 0)

  return () => {
    cancelled = true
    attempt += 1
    window.clearTimeout(loadTimeoutId)
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
}
