import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { type JSONRPCMessage, JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js"
import { isRecord } from "./is-record"

/** The envelope of every message between a host and an app's sandbox. */
const ENVELOPE_TYPE = "mcp-app-host/rpc"
/** The ping the sandbox sends once its script runs, before the app loads. */
const READY_TYPE = "mcp-app-host/ready"

/**
 * What both frames allow besides scripts. An inner frame inherits the restrictions of the outer
 * one, so an app's own `<a target="_blank">` or `window.open` only works when both carry these.
 * `allow-popups-to-escape-sandbox` makes the opened tab a normal page, and `allow-downloads` lets
 * that tab save a file: a browser judges a download by the frame that started the navigation.
 */
const POPUPS_AND_DOWNLOADS = "allow-popups allow-popups-to-escape-sandbox allow-downloads"

/**
 * The `sandbox` attribute of the outer frame, the one a host renders: scripts, popups and
 * downloads, and no `allow-same-origin`, so its origin is opaque and it cannot reach the host.
 */
export const MCP_APP_FRAME_SANDBOX = `allow-scripts ${POPUPS_AND_DOWNLOADS}`

/**
 * The page of the outer frame, which isolates an app from its host. It loads the app's HTML in
 * an inner frame through `srcdoc`, once the host sends
 * `ui/notifications/sandbox-resource-ready`, and relays the JSON-RPC messages both ways in an
 * envelope that names the sandbox. `srcdoc` makes the app parse as a normal document, Tailwind
 * v4's `@layer` CSS included, under the policy the host put at its top.
 *
 * The inner frame has no `allow-same-origin` either, so the app gets an opaque origin of its
 * own: it cannot read or rewrite this page, which relays its messages and carries no policy,
 * and storage and cookies are closed to it. Its Content Security Policy would mean nothing
 * otherwise: an app that reaches this page runs what it wants from there.
 */
function sandboxPage(sandboxId: string): string {
  const id = JSON.stringify(sandboxId)
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;height:100%;overflow:hidden}
iframe{display:block;border:0;width:100%;height:100%}
</style></head><body><script>
(function () {
  var sandboxId = ${id};
  var app = null;
  window.addEventListener("message", function (event) {
    if (event.source === window.parent) {
      var data = event.data;
      if (!data || data.type !== "${ENVELOPE_TYPE}" || data.sandboxId !== sandboxId) return;
      var message = data.message;
      if (message && message.method === "ui/notifications/sandbox-resource-ready") {
        if (app) return;
        app = document.createElement("iframe");
        app.setAttribute("sandbox", "${MCP_APP_FRAME_SANDBOX}");
        app.srcdoc = message.params.html;
        document.body.appendChild(app);
        return;
      }
      if (app && app.contentWindow) app.contentWindow.postMessage(message, "*");
      return;
    }
    if (app && event.source === app.contentWindow) {
      window.parent.postMessage({ type: "${ENVELOPE_TYPE}", sandboxId: sandboxId, message: event.data }, "*");
    }
  });
  window.parent.postMessage({ type: "${READY_TYPE}", sandboxId: sandboxId }, "*");
})();
</script></body></html>`
}

/** Whether a posted message is an envelope of this type from this sandbox. */
function isEnvelopeOf(
  data: unknown,
  type: string,
  sandboxId: string,
): data is Record<string, unknown> {
  return isRecord(data) && data.type === type && data.sandboxId === sandboxId
}

/**
 * Loads the sandbox page into the outer frame, and resolves once its script runs. It waits for
 * the page's own ping and not for `load`, which a frame just added fires for its blank page
 * first. Messages are told apart by the sandbox's random id: an opaque origin cannot be checked,
 * and two cards of a conversation must not read each other's replies.
 */
export function startSandbox(
  frame: HTMLIFrameElement,
  sandboxId: string,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      if (!isEnvelopeOf(event.data, READY_TYPE, sandboxId)) return
      window.removeEventListener("message", handleMessage)
      resolve()
    }
    window.addEventListener("message", handleMessage)
    signal.addEventListener("abort", () => {
      window.removeEventListener("message", handleMessage)
      reject(signal.reason)
    })
    frame.srcdoc = sandboxPage(sandboxId)
  })
}

/** The MCP transport of the host's side of one app, over the sandbox's envelopes. */
export class SandboxTransport implements Transport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  private readonly frame: HTMLIFrameElement
  private readonly sandboxId: string

  constructor(frame: HTMLIFrameElement, sandboxId: string) {
    this.frame = frame
    this.sandboxId = sandboxId
  }

  /** Relays what the app sends, once the SDK's schema proves it a JSON-RPC message. */
  private readonly handleMessage = (event: MessageEvent) => {
    if (!isEnvelopeOf(event.data, ENVELOPE_TYPE, this.sandboxId)) return
    const parsed = JSONRPCMessageSchema.safeParse(event.data.message)
    if (!parsed.success) {
      this.onerror?.(new Error(`The app sent a message that is not JSON-RPC: ${parsed.error}`))
      return
    }
    this.onmessage?.(parsed.data)
  }

  async start(): Promise<void> {
    window.addEventListener("message", this.handleMessage)
  }

  async send(message: JSONRPCMessage): Promise<void> {
    // The sandbox's origin is opaque, so no target origin can name it: the id guards the reply.
    this.frame.contentWindow?.postMessage(
      { type: ENVELOPE_TYPE, sandboxId: this.sandboxId, message },
      "*",
    )
  }

  async close(): Promise<void> {
    window.removeEventListener("message", this.handleMessage)
    this.onclose?.()
  }
}
