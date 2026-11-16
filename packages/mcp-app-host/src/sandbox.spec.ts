import { afterEach, describe, expect, it, vi } from "vitest"
import { MCP_APP_FRAME_SANDBOX, SandboxTransport, startSandbox } from "./sandbox"

/** Posts a message to the host as an app's sandbox does. */
function postFromSandbox(data: unknown) {
  window.dispatchEvent(new MessageEvent("message", { data }))
}

const envelope = (sandboxId: string, message: unknown) => ({
  type: "mcp-app-host/rpc",
  sandboxId,
  message,
})

describe("the outer frame", () => {
  it("runs scripts with an opaque origin", () => {
    expect(MCP_APP_FRAME_SANDBOX.split(" ")).toContain("allow-scripts")
    expect(MCP_APP_FRAME_SANDBOX).not.toContain("allow-same-origin")
  })
})

describe("startSandbox", () => {
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

describe("SandboxTransport", () => {
  const transports: SandboxTransport[] = []

  afterEach(async () => {
    for (const transport of transports.splice(0)) await transport.close()
  })

  async function startTransport(sandboxId: string) {
    const transport = new SandboxTransport(document.createElement("iframe"), sandboxId)
    transports.push(transport)
    const onmessage = vi.fn()
    const onerror = vi.fn()
    transport.onmessage = onmessage
    transport.onerror = onerror
    await transport.start()
    return { onmessage, onerror }
  }

  it("relays the JSON-RPC messages of its own sandbox", async () => {
    const sandboxId = crypto.randomUUID()
    const { onmessage } = await startTransport(sandboxId)
    const message = { jsonrpc: "2.0", id: 1, method: "ui/initialize", params: {} }

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
})
