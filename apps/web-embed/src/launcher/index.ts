/**
 * AgentStudio embed launcher.
 *
 * Drop this IIFE onto any host page via:
 *   <script src="https://…/launcher.js" data-token="<embedToken>" data-position="bottom-right" data-color="#2563eb" data-locale="fr" data-display-mode="modal"></script>
 *
 * The script injects a floating action button and a chat iframe.
 * Clicking the button toggles the iframe open/closed.
 *
 * data-display-mode:
 *   "modal"  (default) — floating bubble above the FAB button
 *   "drawer"           — full-height side panel sliding in from the edge
 */

// Capture currentScript synchronously at evaluation time — it becomes null after the
// script finishes its initial execution, so we cannot read it inside init().
const _currentScript = document.currentScript as HTMLScriptElement | null

function init() {
  const token = _currentScript?.getAttribute("data-token") ?? ""
  const position = (_currentScript?.getAttribute("data-position") ?? "bottom-right") as
    | "bottom-right"
    | "bottom-left"
  const color = _currentScript?.getAttribute("data-color") ?? "#2563eb"
  const locale = _currentScript?.getAttribute("data-locale") ?? ""
  const displayMode = (_currentScript?.getAttribute("data-display-mode") ?? "modal") as
    | "modal"
    | "drawer"

  if (!token) {
    console.warn("[AgentStudio] data-token attribute is required.")
    return
  }

  // Derive the embed app origin from this script's own src URL so the launcher
  // works correctly regardless of environment (dev, staging, production).
  // Derive the embed app base URL from this script's own src, stripping the
  // filename so we get the directory. This works for both CDN paths
  // (https://storage.googleapis.com/my-bucket/launcher.js → …/my-bucket)
  // and local dev (https://connect.localhost:5175/launcher.js → …:5175).
  const scriptSrc = _currentScript?.src ?? ""
  const base = scriptSrc.slice(0, scriptSrc.lastIndexOf("/"))
  const localeParam = locale ? `&locale=${encodeURIComponent(locale)}` : ""
  const iframeSrc = `${base}/index.html?embedToken=${token}${localeParam}&displayMode=${displayMode}`

  if (displayMode === "drawer") {
    injectDrawerWidget({ token, position, color, iframeSrc })
  } else {
    injectModalWidget({ token, position, color, iframeSrc })
  }
}

interface WidgetOptions {
  token: string
  position: "bottom-right" | "bottom-left"
  color: string
  iframeSrc: string
}

// ─── Modal (floating bubble) ───────────────────────────────────────────────

function injectModalWidget({ position, color, iframeSrc }: WidgetOptions) {
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
  iframe.setAttribute("allow", "microphone; clipboard-write")
  iframe.setAttribute("title", "Chat")

  const button = makeFabButton(color)

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

// ─── Drawer (full-height side panel) ──────────────────────────────────────

function injectDrawerWidget({ position, color, iframeSrc }: WidgetOptions) {
  const isRight = position !== "bottom-left"
  const translateOut = isRight ? "translateX(100%)" : "translateX(-100%)"

  // Use a transparent fixed overlay as the containing block for the iframe.
  // This guarantees full-viewport height even when ancestor elements have CSS
  // transforms (e.g. Radix Sidebar), which would otherwise make a directly
  // fixed iframe use the transformed element as its containing block instead
  // of the viewport.
  const overlay = document.createElement("div")
  overlay.style.cssText = [
    "position: fixed",
    "inset: 0",
    "pointer-events: none",
    "z-index: 2147483646",
  ].join(";")

  const iframe = document.createElement("iframe")
  iframe.src = iframeSrc
  iframe.style.cssText = [
    "position: absolute",
    "top: 0",
    "height: 100%",
    isRight ? "right: 0" : "left: 0",
    "width: 400px",
    "max-width: 100vw",
    "border: none",
    "border-radius: 0",
    isRight
      ? "box-shadow: -8px 0 32px rgba(0,0,0,0.15)"
      : "box-shadow: 8px 0 32px rgba(0,0,0,0.15)",
    `transform: ${translateOut}`,
    "transition: transform 0.3s ease",
    "background: white",
    "pointer-events: auto",
  ].join(";")
  iframe.setAttribute("allow", "microphone; clipboard-write")
  iframe.setAttribute("title", "Chat")

  overlay.appendChild(iframe)

  const button = makeFabButton(color)
  button.style.cssText += [
    ";position: fixed",
    "bottom: 24px",
    isRight ? "right: 24px" : "left: 24px",
    "z-index: 2147483647",
    "transition: transform 0.15s ease, opacity 0.2s ease",
  ].join(";")

  let isOpen = false
  let savedBodyOverflow = ""
  let savedBodyPaddingRight = ""

  const open = () => {
    iframe.style.transform = "translateX(0)"
    button.style.opacity = "0"
    button.style.pointerEvents = "none"
    // Lock host-page scroll and compensate for scrollbar disappearing to avoid layout shift.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    savedBodyOverflow = document.body.style.overflow
    savedBodyPaddingRight = document.body.style.paddingRight
    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    isOpen = true
  }

  const close = () => {
    iframe.style.transform = translateOut
    button.style.opacity = "1"
    button.style.pointerEvents = "auto"
    document.body.style.overflow = savedBodyOverflow
    document.body.style.paddingRight = savedBodyPaddingRight
    isOpen = false
  }

  button.addEventListener("click", () => {
    if (isOpen) close()
    else open()
  })

  window.addEventListener("message", (event) => {
    if (event.data?.type === "agent-studio:close") close()
  })

  document.body.appendChild(overlay)
  document.body.appendChild(button)
}

// ─── Shared helpers ────────────────────────────────────────────────────────

function makeFabButton(color: string): HTMLButtonElement {
  const button = document.createElement("button")
  button.setAttribute("aria-label", "Open chat")
  button.style.cssText = [
    "width: 56px",
    "height: 56px",
    "border-radius: 50%",
    `background: ${color}`,
    "border: none",
    "cursor: pointer",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "box-shadow: 0 4px 12px rgba(0,0,0,0.25)",
    "transition: transform 0.15s ease",
  ].join(";")
  button.innerHTML = chatIconSvg()
  return button
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
