import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"

/** The envelope of every message between the Desk and an app's sandbox. */
const ENVELOPE_TYPE = "desk/mcp-app"
/** The ping the sandbox sends once its script runs, before the app loads. */
const READY_TYPE = "desk/mcp-app-ready"

/**
 * The page of the outer frame, which isolates an app from the Desk: it has no `allow-same-origin`,
 * so its origin is opaque. It loads the app's HTML in an inner frame from a blob, once the Desk
 * sends `ui/notifications/sandbox-resource-ready`, and relays the JSON-RPC messages both ways in
 * an envelope that names the sandbox. Popups and downloads are allowed on both frames, as an inner
 * frame inherits the restrictions of the outer one.
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
        app.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads");
        app.src = URL.createObjectURL(new Blob([message.params.html], { type: "text/html" }));
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

/** The sandbox attributes of the outer frame: scripts, popups and downloads, an opaque origin. */
export const SANDBOX_FRAME_PERMISSIONS =
  "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads"

type Envelope = { type: string; sandboxId: string; message?: JSONRPCMessage }

function isEnvelopeOf(data: unknown, type: string, sandboxId: string): data is Envelope {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === type &&
    "sandboxId" in data &&
    data.sandboxId === sandboxId
  )
}

/**
 * Loads the sandbox page into the outer frame, and resolves once its script runs. Messages are
 * told apart by the sandbox's random id: an opaque origin cannot be checked, and two cards of a
 * conversation must not read each other's replies.
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

/** The MCP transport of the Desk's side of one app, over the sandbox's envelopes. */
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

  private readonly handleMessage = (event: MessageEvent) => {
    if (!isEnvelopeOf(event.data, ENVELOPE_TYPE, this.sandboxId) || !event.data.message) return
    this.onmessage?.(event.data.message)
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
