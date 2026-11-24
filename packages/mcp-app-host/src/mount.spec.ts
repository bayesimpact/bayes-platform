import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type McpAppMountOptions, mountMcpApp, toWebUrl } from "./mount"

type FakeBridge = {
  capabilities: Record<string, unknown>
  hostContexts: { locale?: string }[]
  resources: { html: string }[]
  toolInputs: unknown[]
  toolResults: unknown[]
  isClosed: boolean
  onmessage?: (params: { role: string; content: unknown[] }) => Promise<{ isError?: boolean }>
  onopenlink?: (params: { url: string }) => Promise<{ isError?: boolean }>
  onsizechange?: (params: { height?: number }) => void
}

const bridges = vi.hoisted((): FakeBridge[] => [])
/** Whether the fake app answers the handshake. */
const appAnswers = vi.hoisted(() => ({ value: true }))
/** Whether the sandbox page loads. */
const sandboxLoads = vi.hoisted(() => ({ value: true }))

// The bridge and the sandbox talk to a frame the tests' DOM does not run: the bridge records
// what the host sends, and the sandbox is ready at once.
vi.mock("@modelcontextprotocol/ext-apps/app-bridge", () => ({
  AppBridge: class {
    oninitialized?: () => void
    capabilities: Record<string, unknown>
    hostContexts: { locale?: string }[] = []
    resources: { html: string }[] = []
    toolInputs: unknown[] = []
    toolResults: unknown[] = []
    isClosed = false
    constructor(
      _client: unknown,
      _info: unknown,
      capabilities: Record<string, unknown>,
      options: { hostContext: { locale?: string } },
    ) {
      this.capabilities = capabilities
      this.hostContexts.push(options.hostContext)
      bridges.push(this)
    }
    connect = async () => {}
    sendSandboxResourceReady = async (resource: { html: string }) => {
      this.resources.push(resource)
      // The app says it is ready once it has its HTML.
      if (appAnswers.value) setTimeout(() => this.oninitialized?.(), 0)
    }
    setHostContext = (context: { locale?: string }) => {
      this.hostContexts.push(context)
    }
    sendToolInput = async (input: unknown) => {
      this.toolInputs.push(input)
    }
    sendToolResult = async (result: unknown) => {
      this.toolResults.push(result)
    }
    teardownResource = async () => {}
    close = async () => {
      this.isClosed = true
    }
  },
}))
vi.mock("./sandbox", () => ({
  startSandbox: () => (sandboxLoads.value ? Promise.resolve() : new Promise(() => {})),
  SandboxTransport: class {},
}))

/** Says whether the person just clicked, as the browser does. */
function setUserActivation(isActive: boolean) {
  Object.defineProperty(navigator, "userActivation", {
    configurable: true,
    value: { isActive },
  })
}

function mount(overrides: Partial<McpAppMountOptions> = {}) {
  const onReady = vi.fn()
  const onFailed = vi.fn()
  const frame = document.createElement("iframe")
  const mounted = mountMcpApp(frame, {
    html: "<p>Plans</p>",
    hostInfo: { name: "tests", version: "1.0.0" },
    locale: "en",
    getToolData: () => ({ input: { plan: "B" }, result: { releases: 3 } }),
    onReady,
    onFailed,
    ...overrides,
  })
  const bridge = bridges.at(-1)
  if (!bridge) throw new Error("No bridge was created")
  return { frame, mounted, bridge, onReady, onFailed }
}

describe("mountMcpApp", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    appAnswers.value = true
    sandboxLoads.value = true
    setUserActivation(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("hands the sandbox the app's HTML as its server wrote it, an embedded frame included", async () => {
    const html = '<p>Plans</p><iframe src="https://example.org/video"></iframe><p>After</p>'
    const { bridge, onReady } = mount({ html })

    await vi.advanceTimersByTimeAsync(10)

    expect(bridge.resources).toHaveLength(1)
    expect(bridge.resources[0]?.html.endsWith(html)).toBe(true)
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it("puts the strictest policy before the HTML of an app that declares no domain", async () => {
    const { bridge } = mount({ html: "<!doctype html><p>Plans</p>" })

    await vi.advanceTimersByTimeAsync(10)

    const sent = bridge.resources[0]?.html ?? ""
    expect(sent.startsWith('<!doctype html><meta http-equiv="Content-Security-Policy"')).toBe(true)
    expect(sent).toContain("connect-src 'none'")
    expect(sent).toContain("frame-src 'none'")
  })

  it("opens the policy to the domains the app declares, and to no other", async () => {
    const { bridge } = mount({
      csp: { connectDomains: ["https://api.example.org", "'unsafe-eval'"] },
    })

    await vi.advanceTimersByTimeAsync(10)

    const sent = bridge.resources[0]?.html ?? ""
    expect(sent).toContain("connect-src https://api.example.org;")
    expect(sent).not.toContain("unsafe-eval")
  })

  it("sends the tool's input and result once the app is ready, then again for a late listener", async () => {
    const { bridge } = mount()

    await vi.advanceTimersByTimeAsync(10)
    expect(bridge.toolInputs).toEqual([{ arguments: { plan: "B" } }])
    expect(bridge.toolResults).toEqual([
      { content: [{ type: "text", text: "" }], structuredContent: { releases: 3 } },
    ])

    await vi.advanceTimersByTimeAsync(300)
    expect(bridge.toolResults).toHaveLength(3)

    bridge.onsizechange?.({ height: 120.2 })
    bridge.onsizechange?.({ height: 140 })
    expect(bridge.toolResults).toHaveLength(4)
  })

  it("gives the frame the height the app reports", async () => {
    const { bridge, frame } = mount()
    await vi.advanceTimersByTimeAsync(10)

    bridge.onsizechange?.({ height: 120.2 })

    expect(frame.style.height).toBe("121px")
  })

  it("gives the app the person's language, and the next one they pick", async () => {
    const { bridge, mounted } = mount({ locale: "en" })
    await vi.advanceTimersByTimeAsync(10)
    expect(bridge.hostContexts[0]).toMatchObject({ displayMode: "inline", locale: "en" })

    mounted.setLocale("fr")

    expect(bridge.hostContexts.at(-1)).toMatchObject({ displayMode: "inline", locale: "fr" })
  })

  it("gives the app a language picked while it loaded", async () => {
    const { bridge, mounted } = mount({ locale: "en" })

    mounted.setLocale("fr")
    expect(bridge.hostContexts).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(10)

    expect(bridge.hostContexts.at(-1)).toMatchObject({ locale: "fr" })
  })

  it("fails once when the app never says it is ready", async () => {
    appAnswers.value = false
    const { onReady, onFailed } = mount()

    await vi.advanceTimersByTimeAsync(15_100)

    expect(onReady).not.toHaveBeenCalled()
    expect(onFailed).toHaveBeenCalledTimes(1)
  })

  it("fails once when the sandbox page never loads, and names the origin that serves it", async () => {
    sandboxLoads.value = false
    const { bridge, onReady, onFailed } = mount({
      sandbox: { template: "https://usercontent.example" },
    })

    await vi.advanceTimersByTimeAsync(9_900)
    expect(onFailed).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(200)
    expect(onReady).not.toHaveBeenCalled()
    expect(onFailed).toHaveBeenCalledTimes(1)
    expect(String(onFailed.mock.calls[0]?.[0])).toContain("https://usercontent.example")
    expect(bridge.isClosed).toBe(true)
  })

  it("fails once, without throwing, on a page the browser gives no randomUUID and no hash", async () => {
    // What a page served over plain http, or framed by one, gets from the browser.
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) })
    try {
      const { onReady, onFailed } = mount({
        sandbox: { template: "https://{label}.usercontent.example", key: "server-1" },
      })

      await vi.advanceTimersByTimeAsync(10)

      expect(onReady).not.toHaveBeenCalled()
      expect(onFailed).toHaveBeenCalledTimes(1)
      expect(String(onFailed.mock.calls[0]?.[0])).toContain("https")
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("runs an app that needs no origin of its own on such a page", async () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) })
    try {
      const { onReady, onFailed } = mount()

      await vi.advanceTimersByTimeAsync(10)

      expect(onReady).toHaveBeenCalledTimes(1)
      expect(onFailed).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("ends itself when it fails, so its host has nothing left to free", async () => {
    appAnswers.value = false
    const { mounted, bridge, onFailed } = mount()

    await vi.advanceTimersByTimeAsync(15_100)
    expect(bridge.isClosed).toBe(true)

    mounted.unmount()
    mounted.setLocale("fr")
    expect(onFailed).toHaveBeenCalledTimes(1)
    expect(bridge.hostContexts).toHaveLength(1)
  })

  it("stays silent once unmounted, and closes its bridge", async () => {
    appAnswers.value = false
    const { mounted, bridge, onReady, onFailed } = mount()

    mounted.unmount()
    await vi.advanceTimersByTimeAsync(15_100)

    expect(onReady).not.toHaveBeenCalled()
    expect(onFailed).not.toHaveBeenCalled()
    expect(bridge.isClosed).toBe(true)
  })

  describe("a message the app proposes", () => {
    const proposal = { role: "user", content: [{ type: "text", text: " I picked plan B " }] }

    it("reaches a host that takes messages, after a click in the app", async () => {
      const onMessage = vi.fn()
      const { bridge } = mount({ onMessage })

      expect(bridge.capabilities).toHaveProperty("message")
      expect(await bridge.onmessage?.(proposal)).toEqual({})
      expect(onMessage).toHaveBeenCalledWith("I picked plan B")
    })

    it("is refused without a click, without text, or from another role", async () => {
      const onMessage = vi.fn()
      const { bridge } = mount({ onMessage })

      expect(await bridge.onmessage?.({ role: "user", content: [] })).toEqual({ isError: true })
      expect(await bridge.onmessage?.({ ...proposal, role: "assistant" })).toEqual({
        isError: true,
      })
      setUserActivation(false)
      expect(await bridge.onmessage?.(proposal)).toEqual({ isError: true })
      expect(onMessage).not.toHaveBeenCalled()
    })

    it("is refused by a host that takes none, which says so at the handshake", async () => {
      const { bridge } = mount()

      expect(bridge.capabilities).not.toHaveProperty("message")
      expect(await bridge.onmessage?.(proposal)).toEqual({ isError: true })
    })
  })

  describe("a link the app asks to open", () => {
    it("opens in a tab cut off from the host, after a click in the app", async () => {
      const tab = { opener: window }
      // The host only writes `opener` on the tab it opens, which this stand-in has.
      const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window)
      const { bridge } = mount()

      expect(await bridge.onopenlink?.({ url: "https://example.org/report.pdf" })).toEqual({})
      expect(open).toHaveBeenCalledWith("https://example.org/report.pdf", "_blank")
      expect(tab.opener).toBeNull()
    })

    it("is refused without a click, or when it is not a web address", async () => {
      const open = vi.spyOn(window, "open").mockReturnValue(null)
      const { bridge } = mount()

      expect(await bridge.onopenlink?.({ url: "javascript:alert(1)" })).toEqual({ isError: true })
      setUserActivation(false)
      expect(await bridge.onopenlink?.({ url: "https://example.org" })).toEqual({ isError: true })
      expect(open).not.toHaveBeenCalled()
    })
  })
})

describe("toWebUrl", () => {
  it("keeps https and http URLs", () => {
    expect(toWebUrl("https://example.com/file.pdf")).toBe("https://example.com/file.pdf")
    expect(toWebUrl("http://example.com/file.pdf")).toBe("http://example.com/file.pdf")
  })

  it("refuses javascript, data, blob and mailto URLs", () => {
    expect(toWebUrl("javascript:alert(1)")).toBeNull()
    expect(toWebUrl("data:text/html,<script>alert(1)</script>")).toBeNull()
    expect(toWebUrl("blob:https://example.com/uuid")).toBeNull()
    expect(toWebUrl("mailto:someone@example.com")).toBeNull()
  })

  it("refuses relative paths and what is not a URL", () => {
    expect(toWebUrl("/relative/path")).toBeNull()
    expect(toWebUrl("not a url")).toBeNull()
  })
})
