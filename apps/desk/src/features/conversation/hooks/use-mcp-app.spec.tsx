import { I18nProvider } from "@lingui/react"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { activateLocale, i18n } from "@/app/i18n"
import type { ChatMcpApp } from "../chat-messages"
import { useMcpApp } from "./use-mcp-app"

const sentResources = vi.hoisted(() => [] as { html: string }[])
/** The host contexts the Desk gave the app: at its start, then each change. */
const hostContexts = vi.hoisted(() => [] as { locale?: string }[])

// The bridge and the sandbox talk to a frame the tests' DOM does not run: the bridge records what
// the Desk sends the sandbox, and the sandbox is ready at once.
vi.mock("@modelcontextprotocol/ext-apps/app-bridge", () => ({
  AppBridge: class {
    oninitialized?: () => void
    constructor(
      _client: unknown,
      _info: unknown,
      _capabilities: unknown,
      options: { hostContext: { locale?: string } },
    ) {
      hostContexts.push(options.hostContext)
    }
    connect = async () => {}
    sendSandboxResourceReady = async (resource: { html: string }) => {
      sentResources.push(resource)
      // The app says it is ready once it has its HTML.
      setTimeout(() => this.oninitialized?.(), 0)
    }
    setHostContext = (context: { locale?: string }) => {
      hostContexts.push(context)
    }
    sendToolInput = async () => {}
    sendToolResult = async () => {}
    teardownResource = async () => {}
    close = async () => {}
  },
}))
vi.mock("../mcp-app-sandbox", () => ({
  startSandbox: async () => {},
  SandboxTransport: class {},
}))

const app = (): ChatMcpApp => ({
  toolCallId: crypto.randomUUID(),
  mcpServerId: null,
  resourceUri: "ui://plans",
  toolInput: {},
  toolResult: null,
})

const withI18n = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>{children}</I18nProvider>
)

describe("useMcpApp", () => {
  it("hands the sandbox the app's HTML as its server wrote it, an embedded frame included", async () => {
    const html = '<p>Plans</p><iframe src="https://example.org/video"></iframe><p>After</p>'
    const frame = document.createElement("iframe")
    renderHook(
      () =>
        useMcpApp(
          { current: frame },
          { app: app(), html, onMessage: () => {}, onFailed: () => {} },
        ),
      { wrapper: withI18n },
    )

    await waitFor(() => expect(sentResources).toContainEqual({ html }))
  })

  it("gives the app the person's language, and the next one they pick", async () => {
    hostContexts.length = 0
    const frame = document.createElement("iframe")
    const { result } = renderHook(
      () =>
        useMcpApp(
          { current: frame },
          { app: app(), html: "<p>Plans</p>", onMessage: () => {}, onFailed: () => {} },
        ),
      { wrapper: withI18n },
    )
    await waitFor(() => expect(result.current).toBe("ready"))
    expect(hostContexts[0]).toMatchObject({ displayMode: "inline", locale: "en" })

    await act(() => activateLocale("fr"))

    expect(hostContexts.at(-1)).toMatchObject({ displayMode: "inline", locale: "fr" })
  })
})
