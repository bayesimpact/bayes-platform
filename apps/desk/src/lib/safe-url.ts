/** A library file's API path, which redirects to the file. */
const LIBRARY_FILE_PATH =
  /^\/organizations\/[0-9a-f-]{36}\/projects\/[0-9a-f-]{36}\/resource-libraries\/[0-9a-f-]{36}\/resources\/[0-9a-f-]{36}\/file$/

/**
 * Where a resource of a reply may open: an http(s) URL, or a library file's API path on this
 * origin's `/api`. Anything else, such as a `javascript:` URL, is refused with `null`.
 */
export function toResourceUrl(link: string): string | null {
  if (link.startsWith("/")) {
    return LIBRARY_FILE_PATH.test(link) ? `${window.location.origin}/api${link}` : null
  }
  return toHttpsUrl(link, { allowHttp: true })
}

/** The URL when it is https (or http, when allowed), else `null`. */
export function toHttpsUrl(value: string, { allowHttp = false } = {}): string | null {
  try {
    const url = new URL(value)
    const isAllowed = url.protocol === "https:" || (allowHttp && url.protocol === "http:")
    return isAllowed ? url.href : null
  } catch {
    // Not a URL at all.
    return null
  }
}

/**
 * Opens a blank tab during the person's click, cut off from this page, for a URL that arrives
 * later. The browser blocks a tab opened once the click is over.
 */
export function openBlankTab(): Window | null {
  const tab = window.open("", "_blank")
  if (tab) tab.opener = null
  return tab
}
