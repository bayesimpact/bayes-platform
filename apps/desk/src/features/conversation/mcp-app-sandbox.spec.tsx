import { afterEach, describe, expect, it, vi } from "vitest"
import { SandboxTransport } from "./mcp-app-sandbox"

/** Posts a message to the Desk as an app's sandbox does, in its envelope. */
function postFromSandbox(sandboxId: string, message: unknown) {
  window.dispatchEvent(
    new MessageEvent("message", { data: { type: "desk/mcp-app", sandboxId, message } }),
  )
}

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

    postFromSandbox(sandboxId, message)
    postFromSandbox(crypto.randomUUID(), message)

    expect(onmessage).toHaveBeenCalledTimes(1)
    expect(onmessage).toHaveBeenCalledWith(message)
  })

  it("refuses a message that is not JSON-RPC", async () => {
    const sandboxId = crypto.randomUUID()
    const { onmessage, onerror } = await startTransport(sandboxId)

    postFromSandbox(sandboxId, { method: 42 })
    postFromSandbox(sandboxId, undefined)

    expect(onmessage).not.toHaveBeenCalled()
    expect(onerror).toHaveBeenCalledTimes(2)
  })
})
