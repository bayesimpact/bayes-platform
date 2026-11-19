import { afterEach, describe, expect, it, vi } from "vitest"
import { SandboxTransport, startSandbox } from "./sandbox"
import { MCP_APP_FRAME_SANDBOX, MCP_APP_ORIGIN_FRAME_SANDBOX } from "./sandbox-page"

const SANDBOX_ORIGIN = "https://0123456789abcdef.usercontent.example"

/** Posts a message to the host as an app's sandbox does, from a frame and an origin if any. */
function postFromSandbox(data: unknown, from: { origin?: string; source?: Window | null } = {}) {
  window.dispatchEvent(new MessageEvent("message", { data, ...from }))
}

/**
 * A frame with a window a message can come from and go to. The tests' DOM loads no frame, so
 * the window is a stand-in that records what it is sent.
 */
function addFrame(): HTMLIFrameElement {
  const frame = document.createElement("iframe")
  Object.defineProperty(frame, "contentWindow", { value: { postMessage: vi.fn() } })
  return frame
}

/** The origin a frame's stand-in window was addressed at, message by message. */
function targetOriginsOf(frame: HTMLIFrameElement): unknown[] {
  const { postMessage } = frame.contentWindow as Window
  return vi.mocked(postMessage).mock.calls.map((call) => call[1])
}

const envelope = (sandboxId: string, message: unknown) => ({
  type: "mcp-app-host/rpc",
  sandboxId,
  message,
})

afterEach(() => {
  document.body.replaceChildren()
})

describe("startSandbox, without a sandbox origin", () => {
  it("resolves at the ping of its own sandbox, not of another", async () => {
    const sandboxId = crypto.randomUUID()
    const frame = document.createElement("iframe")
    const onReady = vi.fn()
    const started = startSandbox(frame, sandboxId, new AbortController().signal).then(onReady)

    postFromSandbox({ type: "mcp-app-host/ready", sandboxId: crypto.randomUUID() })
    await Promise.resolve()
    expect(onReady).not.toHaveBeenCalled()

    postFromSandbox({ type: "mcp-app-host/ready", sandboxId })
    await started
    expect(onReady).toHaveBeenCalledTimes(1)
    expect(frame.srcdoc).toContain(JSON.stringify(sandboxId))
  })

  it("gives the app's frame an opaque origin of its own", async () => {
    const sandboxId = crypto.randomUUID()
    const frame = document.createElement("iframe")
    const started = startSandbox(frame, sandboxId, new AbortController().signal)
    postFromSandbox({ type: "mcp-app-host/ready", sandboxId })
    await started

    expect(frame.srcdoc).toContain(`app.setAttribute("sandbox", "${MCP_APP_FRAME_SANDBOX}")`)
    expect(frame.srcdoc).not.toContain("allow-same-origin")
  })

  it("rejects when its host gives up first", async () => {
    const controller = new AbortController()
    const started = startSandbox(
      document.createElement("iframe"),
      crypto.randomUUID(),
      controller.signal,
    )

    controller.abort(new Error("The card is gone"))

    await expect(started).rejects.toThrow("The card is gone")
  })
})

describe("startSandbox, with a sandbox origin", () => {
  it("loads the page that origin serves, and lets the frame keep the origin", () => {
    const sandboxId = crypto.randomUUID()
    const frame = addFrame()
    frame.setAttribute("sandbox", MCP_APP_FRAME_SANDBOX)

    void startSandbox(frame, sandboxId, new AbortController().signal, SANDBOX_ORIGIN)

    expect(frame.getAttribute("src")).toBe(`${SANDBOX_ORIGIN}/mcp-app-sandbox.html#${sandboxId}`)
    expect(frame.getAttribute("sandbox")).toBe(MCP_APP_ORIGIN_FRAME_SANDBOX)
    expect(frame.hasAttribute("srcdoc")).toBe(false)
  })

  it("resolves at the ping of its frame at that origin, and at no other", async () => {
    const sandboxId = crypto.randomUUID()
    const frame = addFrame()
    const onReady = vi.fn()
    const started = startSandbox(
      frame,
      sandboxId,
      new AbortController().signal,
      SANDBOX_ORIGIN,
    ).then(onReady)
    const ping = { type: "mcp-app-host/ready", sandboxId }

    postFromSandbox(ping)
    postFromSandbox(ping, { origin: "https://elsewhere.example", source: frame.contentWindow })
    postFromSandbox(ping, { origin: SANDBOX_ORIGIN, source: addFrame().contentWindow })
    await Promise.resolve()
    expect(onReady).not.toHaveBeenCalled()

    postFromSandbox(ping, { origin: SANDBOX_ORIGIN, source: frame.contentWindow })
    await started
    expect(onReady).toHaveBeenCalledTimes(1)
  })
})

describe("SandboxTransport", () => {
  const transports: SandboxTransport[] = []

  afterEach(async () => {
    for (const transport of transports.splice(0)) await transport.close()
  })

  async function startTransport(sandboxId: string, sandboxOrigin?: string) {
    const frame = addFrame()
    const transport = new SandboxTransport(frame, sandboxId, sandboxOrigin)
    transports.push(transport)
    const onmessage = vi.fn()
    const onerror = vi.fn()
    transport.onmessage = onmessage
    transport.onerror = onerror
    await transport.start()
    return { frame, transport, onmessage, onerror }
  }

  const message = { jsonrpc: "2.0" as const, id: 1, method: "ui/initialize", params: {} }

  it("relays the JSON-RPC messages of its own sandbox", async () => {
    const sandboxId = crypto.randomUUID()
    const { onmessage } = await startTransport(sandboxId)

    postFromSandbox(envelope(sandboxId, message))
    postFromSandbox(envelope(crypto.randomUUID(), message))

    expect(onmessage).toHaveBeenCalledTimes(1)
    expect(onmessage).toHaveBeenCalledWith(message)
  })

  it("refuses a message that is not JSON-RPC", async () => {
    const sandboxId = crypto.randomUUID()
    const { onmessage, onerror } = await startTransport(sandboxId)

    postFromSandbox(envelope(sandboxId, { method: 42 }))
    postFromSandbox(envelope(sandboxId, undefined))

    expect(onmessage).not.toHaveBeenCalled()
    expect(onerror).toHaveBeenCalledTimes(2)
  })

  it("with a sandbox origin, relays only what its frame sends from that origin", async () => {
    const sandboxId = crypto.randomUUID()
    const { frame, onmessage } = await startTransport(sandboxId, SANDBOX_ORIGIN)
    const sent = envelope(sandboxId, message)

    postFromSandbox(sent)
    postFromSandbox(sent, { origin: "https://elsewhere.example", source: frame.contentWindow })
    postFromSandbox(sent, { origin: SANDBOX_ORIGIN, source: addFrame().contentWindow })
    expect(onmessage).not.toHaveBeenCalled()

    postFromSandbox(sent, { origin: SANDBOX_ORIGIN, source: frame.contentWindow })
    expect(onmessage).toHaveBeenCalledTimes(1)
  })

  it("addresses what it sends to the sandbox origin, or to any origin without one", async () => {
    const withOrigin = await startTransport(crypto.randomUUID(), SANDBOX_ORIGIN)
    const withoutOrigin = await startTransport(crypto.randomUUID())

    await withOrigin.transport.send(message)
    await withoutOrigin.transport.send(message)

    expect(targetOriginsOf(withOrigin.frame)).toEqual([SANDBOX_ORIGIN])
    expect(targetOriginsOf(withoutOrigin.frame)).toEqual(["*"])
  })
})
