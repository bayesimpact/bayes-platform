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
    // The visible height on phones, where 100vh also counts the space under the browser's bars.
    "max-height: calc(100dvh - 112px)",
    "border: none",
    "border-radius: 18px",
    "box-shadow: 0 16px 48px rgba(0,0,0,0.22)",
    "background: white",
    `transform-origin: ${isRight ? "bottom right" : "bottom left"}`,
  ].join(";")
  iframe.className = "as-frame"
  setFrameShown(iframe, false)
  iframe.setAttribute("allow", "microphone; clipboard-write")
  iframe.setAttribute("title", "Chat")

  const button = makeFabButton(color)
  const { row } = makeFabRow(button, hint, isRight)

  let isOpen = false
  const desktopContainer = container.style.cssText
  const desktopFrame = iframe.style.cssText
  const sheet = phoneSheet(container)

  // On a phone the chat takes the whole screen, as a messenger's does there: a 400 px window
  // left the page scrolling behind it and the keyboard pushing it around. The header's chevron
  // closes it, so the button hides meanwhile.
  let wasFull = false
  let restore = 0
  const layout = () => {
    const full = isOpen && isPhone()
    window.clearTimeout(restore)
    if (wasFull && !full && !isOpen) {
      // Fade the full-screen chat out where it is, then put the window back for next time.
      setFrameShown(iframe, false)
      sheet.set(false)
      wasFull = false
      restore = window.setTimeout(layout, 320)
      return
    }
    wasFull = full
    container.style.cssText = desktopContainer
    iframe.style.cssText = desktopFrame
    if (full) {
      container.style.cssText += PHONE_CONTAINER
      iframe.style.cssText += PHONE_FRAME
      row.style.display = "none"
    } else {
      row.style.display = "flex"
    }
    setFrameShown(iframe, isOpen)
    sheet.set(full)
  }

  // The window grows out of the button, as a messenger does, instead of popping in. Its state
  // lives in inline styles, so a host page whose CSP blocks the stylesheet still gets a chat that
  // opens and closes; the stylesheet only animates between the two states.
  const setOpen = (open: boolean) => {
    isOpen = open
    iframe.classList.toggle("as-frame--open", open)
    setFabOpen(button, open)
    layout()
  }
  window.addEventListener("resize", () => {
    if (isOpen) layout()
  })

  button.addEventListener("click", () => setOpen(!isOpen))

  window.addEventListener("message", (event) => {
    if (event.data?.type === "agent-studio:close") setOpen(false)
  })

  attachPreview({ row, button, iframe, isRight, color, hint, onOpen: () => setOpen(true) })

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
  const sheet = phoneSheet(overlay)

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
    // iOS ignores overflow: hidden on the body, and its keyboard shrinks only the visible part
    // of the screen: on a phone the panel pins the page and follows that visible part.
    sheet.set(isPhone())
    isOpen = true
  }

  const close = () => {
    iframe.style.transform = translateOut
    row.style.opacity = "1"
    button.style.pointerEvents = "auto"
    setFabOpen(button, false)
    sheet.set(false)
    document.body.style.overflow = savedBodyOverflow
    document.body.style.paddingRight = savedBodyPaddingRight
    isOpen = false
  }

  button.addEventListener("click", () => {
    if (isOpen) close()
    else open()
  })

  attachPreview({ row, button, iframe, isRight, color, hint, onOpen: open })

  window.addEventListener("message", (event) => {
    if (event.data?.type === "agent-studio:close") close()
  })

  document.body.appendChild(overlay)
  document.body.appendChild(row)
  exposeResetSession(iframe, iframeSrc)
}

// ─── Shared helpers ────────────────────────────────────────────────────────

/** A phone, or a window as narrow as one: the chat then takes the whole screen. */
const PHONE_QUERY = "(max-width: 640px)"
function isPhone() {
  return window.matchMedia?.(PHONE_QUERY).matches ?? window.innerWidth <= 640
}

const PHONE_CONTAINER = [
  ";top: 0",
  "left: 0",
  "right: 0",
  "bottom: auto",
  "height: 100%",
  "gap: 0",
  "padding: env(safe-area-inset-top, 0) 0 0",
  "background: white",
].join(";")

const PHONE_FRAME = [
  ";width: 100%",
  "max-width: none",
  "height: 100%",
  "max-height: none",
  "border-radius: 0",
  "box-shadow: none",
].join(";")

/** Shows or hides the chat window with inline styles, which a CSP cannot block. */
function setFrameShown(iframe: HTMLIFrameElement, shown: boolean) {
  iframe.style.opacity = shown ? "1" : "0"
  iframe.style.visibility = shown ? "visible" : "hidden"
  iframe.style.pointerEvents = shown ? "auto" : "none"
  iframe.style.transform = shown ? "none" : "translateY(16px) scale(.94)"
}

/**
 * While the chat fills a phone's screen: the host page stays still behind it (iOS scrolls a body
 * with overflow: hidden, so the body is pinned where it was and put back on close), and the chat
 * sizes itself to the part of the screen the keyboard leaves visible, which is what the browser's
 * visualViewport reports. Without it the input slid under the keyboard and the page moved
 * under the visitor's thumb while they typed.
 */
function phoneSheet(box: HTMLElement) {
  let active = false
  let scrollY = 0
  let saved = ""
  let savedBox = ""
  const follow = () => {
    const vv = window.visualViewport
    if (!active || !vv) return
    box.style.top = `${vv.offsetTop}px`
    box.style.height = `${vv.height}px`
  }
  return {
    set(on: boolean) {
      if (on === active) {
        follow()
        return
      }
      active = on
      const body = document.body
      if (on) {
        scrollY = window.scrollY
        saved = body.style.cssText
        savedBox = box.style.cssText
        body.style.position = "fixed"
        body.style.top = `-${scrollY}px`
        body.style.left = "0"
        body.style.right = "0"
        body.style.overflow = "hidden"
        window.visualViewport?.addEventListener("resize", follow)
        window.visualViewport?.addEventListener("scroll", follow)
        follow()
      } else {
        window.visualViewport?.removeEventListener("resize", follow)
        window.visualViewport?.removeEventListener("scroll", follow)
        body.style.cssText = saved
        box.style.cssText = savedBox
        window.scrollTo(0, scrollY)
      }
    },
  }
}

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
 * The row at the bottom corner: the button, and the toast to its inner side. The row lets clicks
 * through to the host page except on the button and the toast themselves.
 */
function makeFabRow(
  button: HTMLButtonElement,
  _hint: string | undefined,
  _isRight: boolean,
): { row: HTMLDivElement } {
  const row = document.createElement("div")
  row.className = "as-row"
  row.style.cssText = [
    "position: relative",
    "display: flex",
    "align-items: center",
    "gap: 10px",
    "pointer-events: none",
  ].join(";")
  row.appendChild(button)
  return { row }
}

/** How long the toast waits after the page loads, and how long it stays, before leaving. */
const TOAST_DELAY_MS = 3000
const TOAST_DURATION_MS = 8000

/**
 * The one message the launcher shows next to its button while the chat is closed, as messengers
 * do: a pill of the button's height and colour, with the start of a message, a cross, and a click
 * that opens the chat.
 *
 * - On the first load in a tab, a few seconds after the page settles, it shows the agent's
 *   greeting (`agent-studio:preview`), or the `data-hint` text when the agent has none, then
 *   leaves by itself.
 * - When a reply ends while the chat is closed (`agent-studio:reply`), it shows the start of that
 *   reply and the button gets a badge, which stays until the chat opens.
 *
 * The cross dismisses that message for the browser tab. Storage that throws only means a message
 * may come back.
 */
function attachPreview({
  row,
  button,
  iframe,
  isRight,
  color,
  hint,
  onOpen,
}: {
  row: HTMLDivElement
  button: HTMLButtonElement
  iframe: HTMLIFrameElement
  isRight: boolean
  color: string
  hint?: string
  onOpen: () => void
}) {
  const { onPrimary } = themeColors(color)
  const read = (store: Storage | undefined, key: string) => {
    try {
      return store?.getItem(key) ?? null
    } catch {
      return null
    }
  }
  const write = (store: Storage | undefined, key: string, value: string) => {
    try {
      store?.setItem(key, value)
    } catch {}
  }
  const session = (() => {
    try {
      return window.sessionStorage
    } catch {
      return undefined
    }
  })()

  const toast = document.createElement("div")
  toast.className = "as-toast"
  toast.setAttribute("role", "button")
  toast.setAttribute("tabindex", "0")
  toast.style.cssText = [
    "height: 60px",
    "box-sizing: border-box",
    "max-width: min(300px, calc(100vw - 120px))",
    "display: flex",
    "align-items: center",
    "gap: 6px",
    `padding: ${isRight ? "0 8px 0 18px" : "0 18px 0 8px"}`,
    "border-radius: 30px",
    `background: ${color}`,
    `color: ${onPrimary}`,
    "box-shadow: 0 6px 20px rgba(0,0,0,0.22)",
    "font: 13px/1.35 system-ui, -apple-system, 'Segoe UI', sans-serif",
    "cursor: pointer",
    `order: ${isRight ? -1 : 1}`,
    `transform-origin: ${isRight ? "right center" : "left center"}`,
    // Hidden by its inline style, so it stays hidden where the page blocks the stylesheet.
    "visibility: hidden",
    "pointer-events: none",
  ].join(";")
  const text = document.createElement("span")
  text.style.cssText =
    "flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden"
  const dismiss = document.createElement("button")
  dismiss.type = "button"
  dismiss.setAttribute("aria-label", "Dismiss")
  dismiss.innerHTML = "&times;"
  dismiss.style.cssText = [
    "flex: none",
    "width: 28px",
    "height: 28px",
    "border-radius: 50%",
    "border: none",
    "background: transparent",
    "color: inherit",
    "opacity: 0.75",
    "font-size: 20px",
    "line-height: 1",
    "cursor: pointer",
    "padding: 0",
  ].join(";")
  if (isRight) toast.append(text, dismiss)
  else toast.append(dismiss, text)
  row.appendChild(toast)

  const badge = document.createElement("span")
  badge.className = "as-badge"
  badge.setAttribute("aria-hidden", "true")
  badge.textContent = "1"
  badge.style.cssText = [
    "position: absolute",
    "top: -2px",
    "right: -2px",
    "min-width: 20px",
    "height: 20px",
    "padding: 0 6px",
    "box-sizing: border-box",
    "border-radius: 10px",
    "background: #e5484d",
    "color: #fff",
    "font: 600 12px/20px system-ui, sans-serif",
    "text-align: center",
    "box-shadow: 0 0 0 2px #fff",
    "display: none",
  ].join(";")
  button.style.position = "relative"
  button.appendChild(badge)

  const isOpen = () => button.classList.contains("as-fab--open")
  let current: { key: string; text: string } | null = null
  let hideTimer: number | undefined

  const setToastOn = (on: boolean) => {
    toast.classList.toggle("as-toast--on", on)
    toast.style.visibility = on ? "visible" : "hidden"
    toast.style.pointerEvents = on ? "auto" : "none"
  }
  const setBadgeOn = (on: boolean) => {
    badge.classList.toggle("as-badge--on", on)
    badge.style.display = on ? "" : "none"
  }
  const hide = () => {
    window.clearTimeout(hideTimer)
    setToastOn(false)
  }
  const show = (key: string, message: string, delay: number) => {
    if (read(session, `agent-studio:dismissed:${key}`)) return
    // Plain text only: the message may carry Markdown the toast does not render.
    const plain = message
      .replace(/[*_`#>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
    if (!plain) return
    current = { key, text: plain }
    window.setTimeout(() => {
      if (current?.key !== key || isOpen()) return
      text.textContent = plain
      toast.setAttribute("aria-label", plain)
      setToastOn(true)
      window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(hide, TOAST_DURATION_MS)
    }, delay)
  }

  // The greeting, once per tab, a few seconds after the page loads.
  let greeting: string | null = hint ?? null
  window.__agentStudioSetHint = (value: string) => {
    if (!greeting || greeting === hint) greeting = value
  }
  const greetOnce = () => {
    if (read(session, "agent-studio:greeted")) return
    write(session, "agent-studio:greeted", "1")
    if (greeting) show("greeting", greeting, 0)
  }
  const greetTimer = window.setTimeout(greetOnce, TOAST_DELAY_MS)

  // Replies: a badge until the chat opens, for a reply that ended while it was closed.
  const markSeen = () => setBadgeOn(false)

  window.addEventListener("message", (event) => {
    if (event.source !== iframe.contentWindow) return
    const data = event.data
    if (data?.type === "agent-studio:preview") {
      if (typeof data.text === "string" && data.text.trim()) greeting = data.text
      return
    }
    if (data?.type !== "agent-studio:reply" || typeof data.id !== "string") return
    // A reply restored with the conversation is not news, nor one the visitor watched arrive.
    if (data.isNew !== true || isOpen()) return
    window.clearTimeout(greetTimer)
    setBadgeOn(true)
    show(`reply:${data.id}`, typeof data.text === "string" ? data.text : "", 0)
  })

  toast.addEventListener("click", (event) => {
    if (event.target === dismiss) return
    onOpen()
  })
  toast.addEventListener("keydown", (event) => {
    if (event.target === dismiss) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onOpen()
    }
  })
  dismiss.addEventListener("click", (event) => {
    event.stopPropagation()
    if (current) write(session, `agent-studio:dismissed:${current.key}`, "1")
    hide()
  })
  new MutationObserver(() => {
    if (isOpen()) {
      hide()
      markSeen()
    }
  }).observe(button, { attributes: true, attributeFilter: ["class"] })
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
    `color: ${themeColors(color).onMark}`,
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
  setFabOpen(button, false)
  // One wave across the dots shortly after load, to say the button is alive without nagging.
  window.setTimeout(() => button.classList.add("as-fab--greet"), 800)
  window.setTimeout(() => button.classList.remove("as-fab--greet"), 2400)
  return button
}

function setFabOpen(button: HTMLButtonElement, open: boolean) {
  // Inline too, so the button shows one icon even where the stylesheet is blocked.
  const dots = button.querySelector<SVGElement>(".as-dots")
  const chevron = button.querySelector<SVGElement>(".as-chevron")
  if (dots) dots.style.opacity = open ? "0" : "1"
  if (chevron) chevron.style.opacity = open ? "1" : "0"
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
.as-toast{opacity:0;transform:scale(.92);visibility:hidden;pointer-events:none;transition:opacity .22s ease,transform .36s cubic-bezier(.16,1,.3,1),visibility 0s linear .36s}
.as-toast--on{opacity:1;transform:none;visibility:visible;pointer-events:auto;transition:opacity .22s ease,transform .36s cubic-bezier(.16,1,.3,1),visibility 0s}
.as-toast:focus-visible{outline:3px solid rgba(0,0,0,.35);outline-offset:3px}
.as-toast button:hover{opacity:1!important}
.as-badge--on{animation:as-pop .3s cubic-bezier(.16,1,.3,1)}
@keyframes as-pop{from{opacity:0;transform:scale(.4)}}
.as-fab:not(.as-fab--open):hover .as-dot,.as-fab--greet:not(.as-fab--open) .as-dot{animation:as-wave .9s cubic-bezier(.45,0,.55,1) calc(var(--as-i) * 80ms) 1}
@keyframes as-wave{0%,100%{transform:scale(1)}40%{transform:scale(1.3)}}
.as-frame{opacity:0;transform:translateY(16px) scale(.94);visibility:hidden;pointer-events:none;transition:opacity .2s ease,transform .32s cubic-bezier(.16,1,.3,1),visibility 0s linear .32s}
.as-frame--open{opacity:1;transform:none;visibility:visible;pointer-events:auto;transition:opacity .2s ease,transform .32s cubic-bezier(.16,1,.3,1),visibility 0s}
@media (prefers-reduced-motion: reduce){.as-fab,.as-dots,.as-dot,.as-chevron,.as-frame,.as-frame--open,.as-toast,.as-toast--on,.as-badge{transition:none!important;animation:none!important}.as-fab:hover{transform:none}}
`
  document.head.appendChild(style)
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
