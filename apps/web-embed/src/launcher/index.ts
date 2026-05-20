/**
 * AgentStudio embed launcher.
 *
 * Drop this IIFE onto any host page via:
 *   <script src="https://…/launcher.js" data-token="<embedToken>" data-position="bottom-right"></script>
 *
 * The script injects a floating action button and a hidden iframe.
 * Clicking the button toggles the iframe open/closed.
 */

const EMBED_APP_ORIGIN = (globalThis as Record<string, unknown>).__EMBED_ORIGIN__ as
  | string
  | undefined

function getCurrentScript(): HTMLOrSVGScriptElement | null {
  return document.currentScript
}

function init() {
  const script = getCurrentScript()
  const token = script?.getAttribute("data-token") ?? ""
  const position = (script?.getAttribute("data-position") ?? "bottom-right") as
    | "bottom-right"
    | "bottom-left"

  if (!token) {
    console.warn("[AgentStudio] data-token attribute is required.")
    return
  }

  const origin = EMBED_APP_ORIGIN ?? "http://localhost:5175"
  const iframeSrc = `${origin}/chat/${token}`

  injectWidget({ token, position, iframeSrc })
}

interface WidgetOptions {
  token: string
  position: "bottom-right" | "bottom-left"
  iframeSrc: string
}

function injectWidget({ position, iframeSrc }: WidgetOptions) {
  const isRight = position === "bottom-right"

  const container = document.createElement("div")
  container.id = "agent-studio-embed"
  container.style.cssText = [
    "position: fixed",
    "bottom: 24px",
    isRight ? "right: 24px" : "left: 24px",
    "z-index: 2147483647",
    "display: flex",
    "flex-direction: column",
    isRight ? "align-items: flex-end" : "align-items: flex-start",
    "gap: 12px",
    "font-family: sans-serif",
  ].join(";")

  const iframe = document.createElement("iframe")
  iframe.src = iframeSrc
  iframe.style.cssText = [
    "width: 380px",
    "height: 600px",
    "max-height: calc(100vh - 100px)",
    "border: none",
    "border-radius: 16px",
    "box-shadow: 0 8px 32px rgba(0,0,0,0.18)",
    "display: none",
    "background: white",
  ].join(";")
  iframe.setAttribute("allow", "microphone")
  iframe.setAttribute("title", "Chat")

  const button = document.createElement("button")
  button.setAttribute("aria-label", "Open chat")
  button.style.cssText = [
    "width: 56px",
    "height: 56px",
    "border-radius: 50%",
    "background: #2563eb",
    "border: none",
    "cursor: pointer",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "box-shadow: 0 4px 12px rgba(37,99,235,0.4)",
    "transition: transform 0.15s ease",
  ].join(";")
  button.innerHTML = chatIconSvg()

  let isOpen = false

  button.addEventListener("click", () => {
    isOpen = !isOpen
    iframe.style.display = isOpen ? "block" : "none"
    button.setAttribute("aria-label", isOpen ? "Close chat" : "Open chat")
    button.innerHTML = isOpen ? closeIconSvg() : chatIconSvg()
  })

  window.addEventListener("message", (event) => {
    if (event.data?.type === "agent-studio:close") {
      isOpen = false
      iframe.style.display = "none"
      button.innerHTML = chatIconSvg()
    }
  })

  container.appendChild(iframe)
  container.appendChild(button)
  document.body.appendChild(container)
}

function chatIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
}

function closeIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
