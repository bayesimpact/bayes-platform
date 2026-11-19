import { AppBridge, type McpUiHostContext } from "@modelcontextprotocol/ext-apps/app-bridge"
import { buildMcpAppCsp, type McpAppCsp, withMcpAppCsp } from "./csp"
import { isRecord } from "./is-record"
import { SandboxTransport, startSandbox } from "./sandbox"
import { type McpAppSandboxSource, resolveSandboxOrigin } from "./sandbox-origin"
import { appMessageText, toCallToolResult } from "./tool-result"

/**
 * How long the sandbox page has to load before its card gives up. A page the host writes itself
 * loads at once. One that a sandbox origin serves may never load: the name does not resolve, the
 * certificate is refused, or a proxy answers for it.
 */
const SANDBOX_TIMEOUT_IN_MILLISECONDS = 10_000
/** How long an app has to say it is ready before its card gives up. */
const INITIALIZE_TIMEOUT_IN_MILLISECONDS = 15_000
/** Apps often listen for their data late: it is sent again after these delays. */
const TOOL_DATA_RESENDS_IN_MILLISECONDS = [50, 250]

/** What a host tells every app about where it shows, apart from the person's language. */
const HOST_CONTEXT = { displayMode: "inline", platform: "web", theme: "light" } as const

/** The context of an app, in the person's language, which MCP Apps take from their host. */
const hostContextOf = (locale: string): McpUiHostContext => ({ ...HOST_CONTEXT, locale })

export type McpAppMountOptions = {
  /** The app's HTML, as its MCP server wrote it. */
  html: string
  /**
   * The domains the app declares (`_meta.ui.csp`). The app runs under a Content Security Policy
   * built from them. Without any, the strictest policy applies: no network and no frame.
   */
  csp?: McpAppCsp
  /**
   * Where the install serves the sandbox, and whose app this is. With an origin, the host and
   * the sandbox name each other's origin in every message. Without one, the host writes the
   * sandbox page itself, in a frame with an opaque origin.
   */
  sandbox?: McpAppSandboxSource
  /** The host's name and version, which the app reads at the handshake. */
  hostInfo: { name: string; version: string }
  /** The person's language, which the app gets in its host context. */
  locale: string
  /**
   * The tool's input and result, read each time they are sent, so a host that refetches them
   * need not restart the app.
   */
  getToolData: () => { input: unknown; result: unknown }
  /**
   * Takes a text the app proposes for the conversation (`ui/message`), for the person to read
   * and send. Without it, the app is told the host takes no messages.
   */
  onMessage?: (text: string) => void
  /** Called once the app finished its handshake: the card can show. */
  onReady: () => void
  /** Called once when the app cannot render, with what went wrong. */
  onFailed: (error: unknown) => void
}

export type McpAppMount = {
  /** Tells the app the person picked another language, without restarting it. */
  setLocale: (locale: string) => void
  /** Ends the app and stops listening to it. An app that failed has already ended. */
  unmount: () => void
}

/** The URL when it is http or https, else `null`: an app opens nothing else. */
export function toWebUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null
  } catch {
    // Not a URL at all.
    return null
  }
}

/** Whether the person just clicked or typed: an app opens a link or writes only then. */
function hasUserActivation(): boolean {
  return navigator.userActivation?.isActive ?? false
}

/**
 * Runs an MCP App in the sandbox of a frame rendered with `MCP_APP_FRAME_SANDBOX`, with the
 * official host bridge: the handshake, the tool's input and result, the app's height, and the
 * links and messages it asks for. The app runs under a Content Security Policy built from the
 * domains it declares. It runs until `unmount`.
 *
 * Two paths open a tab, and both need a real click in the app. Its own anchors navigate
 * natively, which the browser allows from a gesture only. `ui/open-link` checks the browser's
 * transient activation and cuts `opener` on the tab it opens, so either way the tab has the
 * power of a plain link in a reply.
 */
export function mountMcpApp(frame: HTMLIFrameElement, options: McpAppMountOptions): McpAppMount {
  const { html, csp, hostInfo, getToolData, onMessage, onReady, onFailed } = options
  const controller = new AbortController()
  const timers: ReturnType<typeof setTimeout>[] = []
  const sandboxId = crypto.randomUUID()
  let locale = options.locale
  let isInitialized = false
  let hasResentAfterResize = false

  const bridge = new AppBridge(
    null,
    hostInfo,
    { openLinks: {}, logging: {}, sandbox: {}, ...(onMessage ? { message: { text: {} } } : {}) },
    { hostContext: hostContextOf(locale) },
  )

  const sendToolData = () => {
    const { input, result } = getToolData()
    void bridge.sendToolInput({ arguments: isRecord(input) ? input : {} })
    void bridge.sendToolResult(toCallToolResult(result))
  }

  bridge.onsizechange = ({ height }) => {
    if (typeof height === "number" && height > 0) frame.style.height = `${Math.ceil(height)}px`
    if (isInitialized && !hasResentAfterResize) {
      hasResentAfterResize = true
      sendToolData()
    }
  }
  bridge.onopenlink = async ({ url }) => {
    const webUrl = toWebUrl(url)
    if (!webUrl || !hasUserActivation()) return { isError: true }
    const opened = window.open(webUrl, "_blank")
    if (!opened) return { isError: true }
    opened.opener = null
    return {}
  }
  // The text only lands in the message box: the person still reads it and sends it. Like a link,
  // it needs a click or a key press in the app, so an app cannot fill the box on its own.
  bridge.onmessage = async ({ role, content }) => {
    const text = appMessageText(content)
    if (!onMessage || role !== "user" || text === "" || !hasUserActivation()) {
      return { isError: true }
    }
    onMessage(text)
    return {}
  }

  const run = async () => {
    // A timer, so a mount undone at once, as React's double mount in development does, never
    // loads the frame: a frame given its page twice in a row stays empty.
    await new Promise((resolve) => timers.push(setTimeout(resolve, 0)))
    const sandboxOrigin = await resolveSandboxOrigin(options.sandbox, window.location.origin)
    if (controller.signal.aborted) return
    let sandboxTimer: ReturnType<typeof setTimeout> | undefined
    const sandboxTimeout = new Promise<never>((_, reject) => {
      const where = sandboxOrigin ? ` from ${sandboxOrigin}` : ""
      sandboxTimer = setTimeout(
        () => reject(new Error(`The sandbox page did not load${where}`)),
        SANDBOX_TIMEOUT_IN_MILLISECONDS,
      )
      timers.push(sandboxTimer)
    })
    await Promise.race([
      startSandbox(frame, sandboxId, controller.signal, sandboxOrigin),
      sandboxTimeout,
    ])
    clearTimeout(sandboxTimer)
    const initialized = new Promise<void>((resolve, reject) => {
      bridge.oninitialized = () => resolve()
      timers.push(
        setTimeout(
          () => reject(new Error("The app did not initialize")),
          INITIALIZE_TIMEOUT_IN_MILLISECONDS,
        ),
      )
    })
    await bridge.connect(new SandboxTransport(frame, sandboxId, sandboxOrigin))
    // The HTML travels as data, as its server wrote it, behind the policy the host puts first.
    await bridge.sendSandboxResourceReady({ html: withMcpAppCsp(html, buildMcpAppCsp(csp)) })
    await initialized
    if (controller.signal.aborted) return
    isInitialized = true
    // The language may have changed while the app loaded: the bridge sends only what changed.
    bridge.setHostContext(hostContextOf(locale))
    sendToolData()
    for (const delay of TOOL_DATA_RESENDS_IN_MILLISECONDS) {
      timers.push(setTimeout(sendToolData, delay))
    }
    onReady()
  }

  /** Ends the app once: no timer, listener or bridge outlives it. */
  const end = () => {
    if (controller.signal.aborted) return
    controller.abort()
    for (const timer of timers) clearTimeout(timer)
    void bridge
      .teardownResource({})
      .catch(() => {
        // The app may already be gone.
      })
      .finally(() => void bridge.close())
    // The frame keeps its page: a frame emptied, then given the sandbox a moment later, stays
    // on the empty page. The next mount's page replaces the app, and a card that goes takes
    // its frame with it.
  }

  run().catch((error: unknown) => {
    if (controller.signal.aborted) return
    // An app that failed is over: its host need not unmount it to free what it held.
    end()
    onFailed(error)
  })

  return {
    setLocale: (nextLocale) => {
      locale = nextLocale
      if (isInitialized && !controller.signal.aborted) {
        bridge.setHostContext(hostContextOf(nextLocale))
      }
    },
    unmount: end,
  }
}
