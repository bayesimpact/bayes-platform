import { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge"
import { type RefObject, useEffect, useEffectEvent, useState } from "react"
import { toHttpsUrl } from "@/lib/safe-url"
import type { ChatMcpApp } from "../chat-messages"
import { SandboxTransport, startSandbox } from "../mcp-app-sandbox"
import { appMessageText, toCallToolResult } from "../mcp-apps"

/** How long an app has to say it is ready before its card gives up. */
const INITIALIZE_TIMEOUT_IN_MILLISECONDS = 15_000
/** Apps often listen for their data late: it is sent again after these delays. */
const TOOL_DATA_RESENDS_IN_MILLISECONDS = [50, 250]

export type McpAppStatus = "loading" | "ready" | "failed"

type UseMcpAppOptions = {
  app: ChatMcpApp
  html: string
  /** Puts a text the app proposes in the message box, which the person then sends or not. */
  onMessage: (text: string) => void
  /** Called once when the app cannot render. */
  onFailed: () => void
}

/** Whether the person just clicked or typed: an app opens a link or writes only then. */
function hasUserActivation(): boolean {
  return navigator.userActivation?.isActive ?? false
}

/**
 * Runs an MCP App in the sandbox of a frame, with the official host bridge: the handshake, the
 * tool's input and result, the app's height, and the links and messages it asks for. The frame
 * talks to the browser outside React, which an effect is for. The card is keyed by its tool call,
 * so the app restarts only for new HTML.
 */
export function useMcpApp(
  frameRef: RefObject<HTMLIFrameElement | null>,
  { app, html, onMessage, onFailed }: UseMcpAppOptions,
): McpAppStatus {
  const [status, setStatus] = useState<McpAppStatus>("loading")
  // Effect events: the messages refetch into new objects, and a new handler or a refetched app
  // must not restart the app.
  const handleMessage = useEffectEvent((text: string) => onMessage(text))
  const handleFailed = useEffectEvent(() => onFailed())
  const readToolData = useEffectEvent(() => ({
    input: app.toolInput,
    result: toCallToolResult(app.toolResult),
  }))

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const controller = new AbortController()
    const timers: ReturnType<typeof setTimeout>[] = []
    const sandboxId = crypto.randomUUID()
    const bridge = new AppBridge(
      null,
      { name: "caseai-connect-desk", version: "1.0.0" },
      { openLinks: {}, message: { text: {} }, logging: {}, sandbox: {} },
      { hostContext: { displayMode: "inline", platform: "web", theme: "light" } },
    )
    let isInitialized = false
    let hasResentAfterResize = false
    const sendToolData = () => {
      const { input, result } = readToolData()
      void bridge.sendToolInput({ arguments: input })
      void bridge.sendToolResult(result)
    }

    bridge.onsizechange = ({ height }) => {
      if (typeof height === "number" && height > 0) frame.style.height = `${Math.ceil(height)}px`
      if (isInitialized && !hasResentAfterResize) {
        hasResentAfterResize = true
        sendToolData()
      }
    }
    bridge.onopenlink = async ({ url }) => {
      const webUrl = toHttpsUrl(url, { allowHttp: true })
      if (!webUrl || !hasUserActivation()) return { isError: true }
      const opened = window.open(webUrl, "_blank")
      if (!opened) return { isError: true }
      opened.opener = null
      return {}
    }
    bridge.onmessage = async ({ role, content }) => {
      const text = appMessageText(content)
      if (role !== "user" || text === "" || !hasUserActivation()) return { isError: true }
      handleMessage(text)
      return {}
    }

    const run = async () => {
      // A timer, so React's double mount in development does not leave an empty frame.
      await new Promise((resolve) => timers.push(setTimeout(resolve, 0)))
      await startSandbox(frame, sandboxId, controller.signal)
      const initialized = new Promise<void>((resolve, reject) => {
        bridge.oninitialized = () => resolve()
        timers.push(
          setTimeout(
            () => reject(new Error("The app did not initialize")),
            INITIALIZE_TIMEOUT_IN_MILLISECONDS,
          ),
        )
      })
      await bridge.connect(new SandboxTransport(frame, sandboxId))
      // The HTML travels as data and becomes a blob: the app gets it exactly as its server wrote it.
      await bridge.sendSandboxResourceReady({ html })
      await initialized
      if (controller.signal.aborted) return
      isInitialized = true
      sendToolData()
      for (const delay of TOOL_DATA_RESENDS_IN_MILLISECONDS) {
        timers.push(setTimeout(sendToolData, delay))
      }
      setStatus("ready")
    }

    run().catch((error: unknown) => {
      if (controller.signal.aborted) return
      console.error("An MCP App could not render:", error)
      setStatus("failed")
      handleFailed()
    })

    return () => {
      controller.abort()
      for (const timer of timers) clearTimeout(timer)
      void bridge
        .teardownResource({})
        .catch(() => {
          // The app may already be gone.
        })
        .finally(() => void bridge.close())
      // The frame keeps its page: a frame emptied, then given the sandbox a moment later, as
      // React's double mount in development does, stays on the empty page. The next run's page
      // replaces the app, and a card that goes takes its frame with it.
    }
  }, [frameRef, html])

  return status
}
