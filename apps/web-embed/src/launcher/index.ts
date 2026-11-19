/**
 * AgentStudio embed launcher.
 *
 * Drop this IIFE onto any host page via:
 *   <script src="https://…/launcher.js" data-token="<embedToken>" data-position="bottom-right" data-color="#000000" data-locale="fr" data-display-mode="modal" data-hint="Need help?"></script>
 *
 * The script injects a floating action button and a chat iframe.
 * Clicking the button toggles the iframe open/closed.
 *
 * data-display-mode:
 *   "modal"  (default) — floating bubble above the FAB button
 *   "drawer"           — full-height side panel sliding in from the edge
 *
 * data-hint:
 *   Optional short text shown next to the FAB for 5 seconds on page load
 *   and again whenever the user hovers the button.
 *
 * window.__agentStudioResetSession():
 *   Starts a new conversation in the widget, for example when the visitor
 *   logs out of the host site.
 */
import { DEFAULT_PRIMARY_COLOR, themeColors } from "../theme"

declare global {
  interface Window {
    /**
     * Updates the hint bubble text in-place without restarting the launcher.
     * Exposed by the launcher when a data-hint attribute is present.
     * No-op if called before the launcher has initialised.
     */
    __agentStudioSetHint?: (text: string) => void
    /**
     * Drops the stored conversation and starts a new one in the widget.
     * Exposed by the launcher once the iframe is injected.
     */
    __agentStudioResetSession?: () => void
  }
}

// Capture currentScript synchronously at evaluation time — it becomes null after the
// script finishes its initial execution, so we cannot read it inside init().
const _currentScript = document.currentScript as HTMLScriptElement | null

function init() {
  const token = _currentScript?.getAttribute("data-token") ?? ""
  const position = (_currentScript?.getAttribute("data-position") ?? "bottom-right") as
    | "bottom-right"
    | "bottom-left"
  const color = _currentScript?.getAttribute("data-color") ?? DEFAULT_PRIMARY_COLOR
  const locale = _currentScript?.getAttribute("data-locale") ?? ""
  const displayMode = (_currentScript?.getAttribute("data-display-mode") ?? "modal") as
    | "modal"
    | "drawer"
  const hint = _currentScript?.getAttribute("data-hint") ?? undefined

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
    injectDrawerWidget({ token, position, color, iframeSrc, hint })
  } else {
    injectModalWidget({ token, position, color, iframeSrc, hint })
  }
}

interface WidgetOptions {
  token: string
  position: "bottom-right" | "bottom-left"
  color: string
  iframeSrc: string
  hint?: string
}

// ─── Modal (floating bubble) ───────────────────────────────────────────────

function injectModalWidget({ position, color, iframeSrc, hint }: WidgetOptions) {
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
    // Let clicks over empty container space (e.g. the hint) reach the host page.
    "pointer-events: none",
  ].join(";")

  const iframe = document.createElement("iframe")
  iframe.src = iframeSrc
  iframe.style.cssText = [
    // A messenger's size: tall enough that an answer with a list fits without scrolling, and
    // never wider or taller than the screen leaves around the button.
    "width: 400px",
    "max-width: calc(100vw - 32px)",
    "height: 704px",
    "max-height: calc(100vh - 112px)",
    "border: none",
    "border-radius: 18px",
    "box-shadow: 0 16px 48px rgba(0,0,0,0.22)",
    "background: white",
    `transform-origin: ${isRight ? "bottom right" : "bottom left"}`,
  ].join(";")
  iframe.className = "as-frame"
  iframe.setAttribute("allow", "microphone; clipboard-write")
  iframe.setAttribute("title", "Chat")

  const button = makeFabButton(color)
  const { row } = makeFabRow(button, hint, isRight)

  let isOpen = false

  // The window grows out of the button, as a messenger does, instead of popping in: the
  // stylesheet animates its opacity and scale between the two states.
  const setOpen = (open: boolean) => {
    isOpen = open
    iframe.classList.toggle("as-frame--open", open)
    setFabOpen(button, open)
  }

  button.addEventListener("click", () => setOpen(!isOpen))

  window.addEventListener("message", (event) => {
    if (event.data?.type === "agent-studio:close") setOpen(false)
  })

  attachPreview({ row, button, iframe, isRight, color, onOpen: () => setOpen(true) })

  container.appendChild(iframe)
  container.appendChild(row)
  document.body.appendChild(container)
  exposeResetSession(iframe, iframeSrc)
}

// ─── Drawer (full-height side panel) ──────────────────────────────────────

function injectDrawerWidget({ position, color, iframeSrc, hint }: WidgetOptions) {
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
    "transition: transform 0.36s cubic-bezier(0.16, 1, 0.3, 1)",
    "background: white",
    "pointer-events: auto",
  ].join(";")
  iframe.setAttribute("allow", "microphone; clipboard-write")
  iframe.setAttribute("title", "Chat")

  overlay.appendChild(iframe)

  const button = makeFabButton(color)
  const { row } = makeFabRow(button, hint, isRight)

  // The row owns the fixed positioning for the drawer FAB area.
  row.style.cssText += [
    ";position: fixed",
    "bottom: 24px",
    isRight ? "right: 24px" : "left: 24px",
    "z-index: 2147483647",
    "transition: opacity 0.2s ease",
  ].join(";")

  let isOpen = false
  let savedBodyOverflow = ""
  let savedBodyPaddingRight = ""

  const open = () => {
    iframe.style.transform = "translateX(0)"
    row.style.opacity = "0"
    // Row stays pointer-events: none so the hint never captures clicks. Disable
    // the FAB itself — children with pointer-events: auto still receive events
    // under a none parent.
    button.style.pointerEvents = "none"
    setFabOpen(button, true)
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
    row.style.opacity = "1"
    button.style.pointerEvents = "auto"
    setFabOpen(button, false)
    document.body.style.overflow = savedBodyOverflow
    document.body.style.paddingRight = savedBodyPaddingRight
    isOpen = false
  }

  button.addEventListener("click", () => {
    if (isOpen) close()
    else open()
  })

  attachPreview({ row, button, iframe, isRight, color, onOpen: open })

  window.addEventListener("message", (event) => {
    if (event.data?.type === "agent-studio:close") close()
  })

  document.body.appendChild(overlay)
  document.body.appendChild(row)
  exposeResetSession(iframe, iframeSrc)
}

// ─── Shared helpers ────────────────────────────────────────────────────────

/**
 * Lets the host page start a new conversation. The widget keeps the session
 * in its own localStorage, which the host page cannot reach.
 */
function exposeResetSession(iframe: HTMLIFrameElement, iframeSrc: string) {
  const targetOrigin = new URL(iframeSrc, window.location.href).origin
  window.__agentStudioResetSession = () => {
    iframe.contentWindow?.postMessage({ type: "agent-studio:reset-session" }, targetOrigin)
  }
}

/**
 * Wraps the FAB button (and an optional hint bubble) in a flex row.
 * When hint is provided the bubble auto-shows for 5 s on page load
 * and reappears whenever the button is hovered.
 */
function makeFabRow(
  button: HTMLButtonElement,
  hint: string | undefined,
  isRight: boolean,
): { row: HTMLDivElement } {
  const row = document.createElement("div")
  row.className = "as-row"
  row.style.cssText = [
    "position: relative",
    "display: flex",
    "align-items: center",
    "gap: 10px",
    // The hint is decorative and hidden with opacity, so it would otherwise
    // keep swallowing clicks on the host page. Re-enable on the FAB only.
    "pointer-events: none",
  ].join(";")

  if (hint) {
    const bubble = document.createElement("div")
    bubble.className = "as-hint"
    bubble.textContent = hint
    bubble.style.cssText = [
      "background: white",
      "color: #374151",
      "font-size: 13px",
      "line-height: 1.4",
      "font-family: sans-serif",
      "padding: 8px 14px",
      "border-radius: 10px",
      "box-shadow: 0 2px 16px rgba(0,0,0,0.14)",
      "white-space: nowrap",
      "opacity: 0",
      "transition: opacity 0.25s ease",
      "pointer-events: none",
      "user-select: none",
    ].join(";")

    // Hint sits to the left of the button when on the right edge, and vice-versa.
    if (isRight) {
      row.appendChild(bubble)
      row.appendChild(button)
    } else {
      row.appendChild(button)
      row.appendChild(bubble)
    }

    let autoHideTimer: ReturnType<typeof setTimeout> | null = null

    const showHint = () => {
      bubble.style.opacity = "1"
    }
    const hideHint = () => {
      bubble.style.opacity = "0"
    }

    // Auto-show for 5 seconds on page load.
    showHint()
    autoHideTimer = setTimeout(hideHint, 5000)

    button.addEventListener("mouseenter", () => {
      if (autoHideTimer) {
        clearTimeout(autoHideTimer)
        autoHideTimer = null
      }
      showHint()
    })
    button.addEventListener("mouseleave", hideHint)

    // Allow the host page (e.g. the Studio app) to update the hint text
    // in-place when the user's locale changes, without restarting the launcher.
    window.__agentStudioSetHint = (text: string) => {
      bubble.textContent = text
    }
  } else {
    row.appendChild(button)
  }

  return { row }
}

/**
 * The card above the button while the chat is closed, as a messenger shows its greeting: the
 * chat frame sends the agent's opening message once it has loaded (`agent-studio:preview`), and
 * the card shows it until the visitor opens the chat, writes, or dismisses it. A dismissal lasts
 * for the browser tab, and storage that throws only means the card comes back.
 */
function attachPreview({
  row,
  button,
  iframe,
  isRight,
  color,
  onOpen,
}: {
  row: HTMLDivElement
  button: HTMLButtonElement
  iframe: HTMLIFrameElement
  isRight: boolean
  color: string
  onOpen: () => void
}) {
  const dismissKey = "agent-studio:preview-dismissed"
  const isDismissed = () => {
    try {
      return sessionStorage.getItem(dismissKey) === "1"
    } catch {
      return false
    }
  }

  const card = document.createElement("div")
  card.className = "as-preview"
  card.setAttribute("role", "button")
  card.setAttribute("tabindex", "0")
  card.style.cssText = [
    "position: absolute",
    "bottom: calc(100% + 14px)",
    isRight ? "right: 0" : "left: 0",
    "width: 300px",
    "max-width: calc(100vw - 48px)",
    "box-sizing: border-box",
    "background: white",
    "color: #1b1f24",
    "border-radius: 16px",
    "padding: 14px 16px",
    "box-shadow: 0 10px 34px rgba(0,0,0,0.16)",
    "font: 14px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif",
    "cursor: pointer",
    `transform-origin: ${isRight ? "bottom right" : "bottom left"}`,
  ].join(";")

  const head = document.createElement("div")
  head.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:6px"
  const avatar = document.createElement("span")
  avatar.style.cssText = [
    "width: 24px",
    "height: 24px",
    "border-radius: 50%",
    "flex: none",
    "display: inline-flex",
    "align-items: center",
    "justify-content: center",
    `background: ${color}`,
    `color: ${themeColors(color).onPrimary}`,
  ].join(";")
  avatar.innerHTML = dotsIconSvg(14)
  const title = document.createElement("span")
  title.style.cssText =
    "font-weight:600;font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
  const dismiss = document.createElement("button")
  dismiss.setAttribute("aria-label", "Dismiss")
  dismiss.innerHTML = "&times;"
  dismiss.style.cssText =
    "border:none;background:none;color:#6b7280;font-size:18px;line-height:1;cursor:pointer;padding:0 2px"
  head.append(avatar, title, dismiss)

  const text = document.createElement("div")
  text.style.cssText =
    "display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden"
  card.append(head, text)
  row.appendChild(card)

  let message: string | null = null
  const render = () => {
    const show = Boolean(message) && !isDismissed() && !button.classList.contains("as-fab--open")
    card.classList.toggle("as-preview--on", show)
    row.classList.toggle("as-row--preview", show)
  }

  window.addEventListener("message", (event) => {
    if (event.source !== iframe.contentWindow || event.data?.type !== "agent-studio:preview") return
    const raw = typeof event.data.text === "string" ? event.data.text : null
    // Plain text only: the greeting may carry Markdown the card does not render.
    message = raw
      ? raw
          .replace(/[*_`#>]/g, "")
          .replace(/\s+/g, " ")
          .trim()
      : null
    text.textContent = message ?? ""
    title.textContent = typeof event.data.title === "string" ? event.data.title : ""
    title.style.display = title.textContent ? "" : "none"
    // Let the page settle before the card slides in.
    window.setTimeout(render, 1200)
  })

  card.addEventListener("click", (event) => {
    if (event.target === dismiss) return
    onOpen()
  })
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") onOpen()
  })
  dismiss.addEventListener("click", (event) => {
    event.stopPropagation()
    try {
      sessionStorage.setItem(dismissKey, "1")
    } catch {}
    render()
  })
  new MutationObserver(render).observe(button, { attributes: true, attributeFilter: ["class"] })
}

function makeFabButton(color: string): HTMLButtonElement {
  injectLauncherStyles()
  const button = document.createElement("button")
  button.className = "as-fab"
  button.setAttribute("aria-label", "Open chat")
  button.setAttribute("aria-expanded", "false")
  button.style.cssText = [
    "width: 60px",
    "height: 60px",
    "border-radius: 50%",
    `background: ${color}`,
    `color: ${themeColors(color).onPrimary}`,
    "border: none",
    "cursor: pointer",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "box-shadow: 0 6px 20px rgba(0,0,0,0.22)",
    "padding: 0",
    "pointer-events: auto",
  ].join(";")
  button.innerHTML = `<span class="as-ico">${dotsIconSvg()}${chevronDownSvg()}</span>`
  // One wave across the dots shortly after load, to say the button is alive without nagging.
  window.setTimeout(() => button.classList.add("as-fab--greet"), 800)
  window.setTimeout(() => button.classList.remove("as-fab--greet"), 2400)
  return button
}

function setFabOpen(button: HTMLButtonElement, open: boolean) {
  button.classList.toggle("as-fab--open", open)
  button.setAttribute("aria-expanded", String(open))
  button.setAttribute("aria-label", open ? "Close chat" : "Open chat")
}

/** The chevron the button shows while the chat is open: pressing it folds the window back. */
function chevronDownSvg() {
  return `<svg class="as-chevron" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`
}

/**
 * The launcher's icon: the 3×3 grid of dots of the Bayes mark. Each dot carries its distance from
 * the top-left corner, which staggers the hover wave. Open, the grid gathers into its centre and
 * gives way to a chevron, as a messenger's launcher does.
 */
function dotsIconSvg(size = 26) {
  const dots: string[] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      dots.push(
        `<circle class="as-dot" style="--as-i:${row + col}" cx="${6 + col * 6}" cy="${6 + row * 6}" r="1.8" fill="currentColor"/>`,
      )
    }
  }
  return `<svg class="as-dots" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${dots.join("")}</svg>`
}

/**
 * The launcher's motion, in one stylesheet injected once into the host page. Class names carry
 * an `as-` prefix so the host's own styles cannot match them. Everything stops for visitors who
 * ask their system for reduced motion.
 */
function injectLauncherStyles() {
  if (document.getElementById("agent-studio-embed-styles")) return
  const style = document.createElement("style")
  style.id = "agent-studio-embed-styles"
  style.textContent = `
.as-fab{transition:transform .2s cubic-bezier(.16,1,.3,1),box-shadow .2s ease}
.as-fab:hover{transform:scale(1.07);box-shadow:0 10px 28px rgba(0,0,0,.26)}
.as-fab:active{transform:scale(.94)}
.as-fab:focus-visible{outline:3px solid rgba(0,0,0,.35);outline-offset:3px}
.as-ico{position:relative;display:block;width:28px;height:28px}
.as-ico>svg{position:absolute;inset:0;margin:auto}
.as-dots{transition:transform .32s cubic-bezier(.16,1,.3,1),opacity .2s ease}
.as-chevron{opacity:0;transform:rotate(-90deg) scale(.6);transition:transform .36s cubic-bezier(.16,1,.3,1),opacity .2s ease}
.as-fab--open .as-chevron{opacity:1;transform:none}
.as-dot{transform-box:fill-box;transform-origin:center;transition:opacity .18s ease,transform .3s cubic-bezier(.16,1,.3,1)}
.as-fab--open .as-dots{transform:scale(.3) rotate(90deg);opacity:0}
.as-row:has(.as-fab--open) .as-hint,.as-row--preview .as-hint{opacity:0!important}
.as-preview{opacity:0;transform:translateY(10px) scale(.96);visibility:hidden;pointer-events:none;transition:opacity .22s ease,transform .36s cubic-bezier(.16,1,.3,1),visibility 0s linear .36s}
.as-preview--on{opacity:1;transform:none;visibility:visible;pointer-events:auto;transition:opacity .22s ease,transform .36s cubic-bezier(.16,1,.3,1),visibility 0s}
.as-preview--on:hover{box-shadow:0 14px 40px rgba(0,0,0,.2)}
.as-fab:not(.as-fab--open):hover .as-dot,.as-fab--greet:not(.as-fab--open) .as-dot{animation:as-wave .9s cubic-bezier(.45,0,.55,1) calc(var(--as-i) * 80ms) 1}
@keyframes as-wave{0%,100%{transform:scale(1)}40%{transform:scale(1.3)}}
.as-frame{opacity:0;transform:translateY(16px) scale(.94);visibility:hidden;pointer-events:none;transition:opacity .2s ease,transform .32s cubic-bezier(.16,1,.3,1),visibility 0s linear .32s}
.as-frame--open{opacity:1;transform:none;visibility:visible;pointer-events:auto;transition:opacity .2s ease,transform .32s cubic-bezier(.16,1,.3,1),visibility 0s}
@media (prefers-reduced-motion: reduce){.as-fab,.as-dots,.as-dot,.as-chevron,.as-frame,.as-frame--open,.as-preview,.as-preview--on{transition:none!important;animation:none!important}.as-fab:hover{transform:none}}
`
  document.head.appendChild(style)
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
