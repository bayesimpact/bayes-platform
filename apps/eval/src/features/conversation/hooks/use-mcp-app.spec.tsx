import type { ChatMcpApp } from "@caseai-connect/chat"
import type { McpAppMountOptions } from "@caseai-connect/mcp-app-host"
import { I18nProvider } from "@lingui/react"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { activateLocale, i18n } from "@/app/i18n"
import { useMcpApp } from "./use-mcp-app"

/** What Evaluation asked the shared host to run, and what it told the running apps since. */
const host = vi.hoisted(
  (): { mounts: McpAppMountOptions[]; locales: string[]; unmounts: number } => ({
    mounts: [],
    locales: [],
    unmounts: 0,
  }),
)

// The shared host runs the app in a frame the tests' DOM does not run: it records what Evaluation
// asks for, and its own specs cover the bridge and the sandbox.
vi.mock("@caseai-connect/mcp-app-host", () => ({
  mountMcpApp: (_frame: HTMLIFrameElement, options: McpAppMountOptions) => {
    host.mounts.push(options)
    return {
      setLocale: (locale: string) => host.locales.push(locale),
      unmount: () => {
        host.unmounts += 1
      },
    }
  },
}))

const app = (overrides: Partial<ChatMcpApp> = {}): ChatMcpApp => ({
  toolCallId: crypto.randomUUID(),
  mcpServerId: null,
  resourceUri: "ui://plans",
  toolInput: {},
  toolResult: null,
  ...overrides,
})

const withI18n = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>{children}</I18nProvider>
)

function renderCard(options: Partial<Parameters<typeof useMcpApp>[1]> = {}) {
  // One ref for the card's life, as `useRef` gives: a new one would restart the app.
  const frameRef = { current: document.createElement("iframe") }
  return renderHook(
    (props: Partial<Parameters<typeof useMcpApp>[1]>) =>
      useMcpApp(frameRef, {
        app: app(),
        html: "<p>Plans</p>",
        mcpServerId: "server-1",
        onMessage: () => {},
        onFailed: () => {},
        ...options,
        ...props,
      }),
    { wrapper: withI18n, initialProps: {} },
  )
}

/** The options of the app Evaluation runs now. */
function lastMount(): McpAppMountOptions {
  const mount = host.mounts.at(-1)
  if (!mount) throw new Error("Evaluation ran no app")
  return mount
}

describe("useMcpApp", () => {
  beforeEach(async () => {
    host.mounts.length = 0
    host.locales.length = 0
    host.unmounts = 0
    await act(() => activateLocale("en"))
  })

  it("runs the app with its HTML as its server wrote it, under Evaluation's name", () => {
    const html = '<p>Plans</p><iframe src="https://example.org/video"></iframe><p>After</p>'
    renderCard({ html })

    expect(lastMount()).toMatchObject({ html, hostInfo: { name: "caseai-connect-eval" } })
  })

  it("shows the card once the app is ready, and gives up when it fails", async () => {
    const onFailed = vi.fn()
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const { result } = renderCard({ onFailed })
    expect(result.current).toBe("loading")

    act(() => lastMount().onReady())
    expect(result.current).toBe("ready")

    act(() => lastMount().onFailed(new Error("The app did not initialize")))
    expect(result.current).toBe("failed")
    expect(onFailed).toHaveBeenCalledTimes(1)
    error.mockRestore()
  })

  it("gives the app the person's language, and the next one they pick", async () => {
    renderCard()
    expect(lastMount().locale).toBe("en")

    await act(() => activateLocale("fr"))

    await waitFor(() => expect(host.locales.at(-1)).toBe("fr"))
    expect(host.mounts).toHaveLength(1)
  })

  it("reads the tool's data and the message handler as they are now, without a restart", () => {
    const first = app({ toolResult: { releases: 1 } })
    const onMessage = vi.fn()
    const { rerender } = renderCard({ app: first })

    rerender({ app: { ...first, toolResult: { releases: 2 } }, onMessage })

    expect(host.mounts).toHaveLength(1)
    expect(lastMount().getToolData()).toEqual({ input: {}, result: { releases: 2 } })
    lastMount().onMessage?.("I picked plan B")
    expect(onMessage).toHaveBeenCalledWith("I picked plan B")
  })

  it("restarts the app for new HTML, and ends it with its card", () => {
    const { rerender, unmount } = renderCard()

    rerender({ html: "<p>New plans</p>" })
    expect(host.unmounts).toBe(1)
    expect(lastMount().html).toBe("<p>New plans</p>")

    unmount()
    expect(host.unmounts).toBe(2)
  })

  it("names the app's MCP server for its sandbox, and restarts the app for another server", () => {
    const { rerender } = renderCard()
    expect(lastMount().sandbox).toMatchObject({ key: "server-1" })

    rerender({ mcpServerId: "server-2" })
    expect(host.unmounts).toBe(1)
    expect(lastMount().sandbox).toMatchObject({ key: "server-2" })
  })
})
