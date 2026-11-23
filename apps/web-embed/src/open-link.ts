/**
 * Where the chat opens the links of its messages and resource cards.
 *
 * - "blank" (default): the link opens in a new tab from inside the iframe.
 * - "parent": the click is cancelled and the address is sent to the host page as
 *   `{ type: "agent-studio:open-link", url }`, which opens it itself. Hosts that sandbox the
 *   iframe without `allow-popups` need this, since a `target="_blank"` link does nothing there.
 *
 * Set with the `linkTarget` URL parameter of the chat page (`data-link-target` on the launcher).
 */
export type LinkTarget = "blank" | "parent"

export const OPEN_LINK_MESSAGE = "agent-studio:open-link"

export function readLinkTarget(search: string): LinkTarget {
  return new URLSearchParams(search).get("linkTarget") === "parent" ? "parent" : "blank"
}

/** The web address a click lands on, or null when the click is not on a web link. */
export function clickedLinkUrl(event: Pick<MouseEvent, "target">): string | null {
  const target = event.target
  if (!(target instanceof Element)) return null
  const anchor = target.closest("a[href]")
  if (!(anchor instanceof HTMLAnchorElement)) return null
  return /^https?:$/.test(anchor.protocol) ? anchor.href : null
}

/**
 * Sends every web link the visitor clicks to the host page instead of opening it.
 * Returns the cleanup function.
 */
export function sendLinksToParent(win: Window = window): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return
    const url = clickedLinkUrl(event)
    if (!url) return
    event.preventDefault()
    // A link the agent already shows the visitor, so any host origin may read it.
    win.parent.postMessage({ type: OPEN_LINK_MESSAGE, url }, "*")
  }
  win.document.addEventListener("click", onClick, true)
  return () => win.document.removeEventListener("click", onClick, true)
}
