import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { type JSONRPCMessage, JSONRPCMessageSchema } from "@modelcontextprotocol/sdk/types.js"
import { isRecord } from "./is-record"
import {
  ENVELOPE_TYPE,
  inlineSandboxPage,
  MCP_APP_ORIGIN_FRAME_SANDBOX,
  MCP_APP_SANDBOX_PATH,
  READY_TYPE,
} from "./sandbox-page"

/** Whether a posted message is an envelope of this type from this sandbox. */
function isEnvelopeOf(
  data: unknown,
  type: string,
  sandboxId: string,
): data is Record<string, unknown> {
  return isRecord(data) && data.type === type && data.sandboxId === sandboxId
}

/**
 * Whether a message comes from the sandbox of this frame. With a sandbox origin, the browser
 * says so: the message comes from the frame's window, at that origin. Without one, the origin
 * is opaque and cannot be checked, so the envelope's random id alone tells the sandboxes apart.
 */
function isFromSandbox(
  event: MessageEvent,
  frame: HTMLIFrameElement,
  sandboxOrigin: string | undefined,
): boolean {
  if (sandboxOrigin === undefined) return true
  const frameWindow = frame.contentWindow
  return frameWindow !== null && event.source === frameWindow && event.origin === sandboxOrigin
}

/**
 * Loads the sandbox page into the outer frame, and resolves once its script runs. It waits for
 * the page's own ping and not for `load`, which a frame just added fires for its blank page
 * first.
 *
 * With a sandbox origin, the frame loads the page that origin serves and keeps the origin: the
 * `sandbox` attribute is set here, before the navigation it applies to. Without one, the host
 * writes the page into `srcdoc`, and the frame keeps the opaque origin its host rendered it
 * with.
 */
export function startSandbox(
  frame: HTMLIFrameElement,
  sandboxId: string,
  signal: AbortSignal,
  sandboxOrigin?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      if (!isEnvelopeOf(event.data, READY_TYPE, sandboxId)) return
      if (!isFromSandbox(event, frame, sandboxOrigin)) return
      window.removeEventListener("message", handleMessage)
      resolve()
    }
    window.addEventListener("message", handleMessage)
    signal.addEventListener("abort", () => {
      window.removeEventListener("message", handleMessage)
      reject(signal.reason)
    })
    if (sandboxOrigin === undefined) {
      frame.srcdoc = inlineSandboxPage(sandboxId)
      return
    }
    frame.setAttribute("sandbox", MCP_APP_ORIGIN_FRAME_SANDBOX)
    frame.removeAttribute("srcdoc")
    frame.src = `${sandboxOrigin}${MCP_APP_SANDBOX_PATH}#${encodeURIComponent(sandboxId)}`
  })
}

/** The MCP transport of the host's side of one app, over the sandbox's envelopes. */
export class SandboxTransport implements Transport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  private readonly frame: HTMLIFrameElement
  private readonly sandboxId: string
  private readonly sandboxOrigin: string | undefined

  constructor(frame: HTMLIFrameElement, sandboxId: string, sandboxOrigin?: string) {
    this.frame = frame
    this.sandboxId = sandboxId
    this.sandboxOrigin = sandboxOrigin
  }

  /** Relays what the app sends, once the SDK's schema proves it a JSON-RPC message. */
  private readonly handleMessage = (event: MessageEvent) => {
    if (!isEnvelopeOf(event.data, ENVELOPE_TYPE, this.sandboxId)) return
    if (!isFromSandbox(event, this.frame, this.sandboxOrigin)) return
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
    // Without a sandbox origin, the frame's origin is opaque and no target origin can name it:
    // the id guards the reply.
    this.frame.contentWindow?.postMessage(
      { type: ENVELOPE_TYPE, sandboxId: this.sandboxId, message },
      this.sandboxOrigin ?? "*",
    )
  }

  async close(): Promise<void> {
    window.removeEventListener("message", this.handleMessage)
    this.onclose?.()
  }
}
