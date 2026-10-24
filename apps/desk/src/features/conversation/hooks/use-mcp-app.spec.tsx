import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useMcpApp } from "./use-mcp-app"

const sentResources = vi.hoisted(() => [] as { html: string }[])

// The bridge and the sandbox talk to a frame the tests' DOM does not run: the bridge records what
// the Desk sends the sandbox, and the sandbox is ready at once.
vi.mock("@modelcontextprotocol/ext-apps/app-bridge", () => ({
  AppBridge: class {
    connect = async () => {}
    sendSandboxResourceReady = async (resource: { html: string }) => {
      sentResources.push(resource)
    }
    teardownResource = async () => {}
    close = async () => {}
  },
}))
vi.mock("../mcp-app-sandbox", () => ({
  startSandbox: async () => {},
  SandboxTransport: class {},
}))

describe("useMcpApp", () => {
  it("hands the sandbox the app's HTML as its server wrote it, an embedded frame included", async () => {
    const html = '<p>Plans</p><iframe src="https://example.org/video"></iframe><p>After</p>'
    const frame = document.createElement("iframe")
    renderHook(() =>
      useMcpApp(
        { current: frame },
        {
          app: {
            toolCallId: crypto.randomUUID(),
            mcpServerId: null,
            resourceUri: "ui://plans",
            toolInput: {},
            toolResult: null,
          },
          html,
          onMessage: () => {},
          onFailed: () => {},
        },
      ),
    )

    await waitFor(() => expect(sentResources).toEqual([{ html }]))
  })
})
