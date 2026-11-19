/**
 * The domains an MCP App declares in its resource metadata (`_meta.ui.csp` of the MCP Apps
 * specification). A host builds the app's Content Security Policy from them, and blocks every
 * other domain. The package types what it reads itself: each host passes what its API sent.
 */
export type McpAppCsp = {
  /** Origins the app may reach with fetch, XHR or WebSocket (`connect-src`). */
  connectDomains?: string[]
  /** Origins the app may load scripts, styles, images, fonts and media from. */
  resourceDomains?: string[]
  /** Origins the app may embed in a frame (`frame-src`). */
  frameDomains?: string[]
  /** Origins the app's `<base>` may point at (`base-uri`). */
  baseUriDomains?: string[]
}

/**
 * An origin an app may declare: a scheme, a host (whose first label may be `*`) and an optional
 * port. Nothing else, so a declared value cannot add a directive or a keyword such as
 * `'unsafe-eval'` to the policy.
 */
const DECLARED_ORIGIN_PATTERN =
  /^(?:https?|wss?):\/\/(?:\*\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*(?::\d{1,5})?$/i

/** The declared values that are origins, the rest left out. */
export function toCspSources(declared: string[] | undefined): string[] {
  return (declared ?? []).filter((origin) => DECLARED_ORIGIN_PATTERN.test(origin))
}

function directive(name: string, sources: string[]): string {
  return `${name} ${sources.join(" ")}`
}

/**
 * The Content Security Policy of an MCP App, built as the MCP Apps specification asks: the
 * strict default when the app declares nothing, widened only by the origins it declares. Forms
 * and plugins stay off, since the specification gives an app no way to need them.
 */
export function buildMcpAppCsp(declared: McpAppCsp | undefined): string {
  const resourceSources = toCspSources(declared?.resourceDomains)
  const connectSources = toCspSources(declared?.connectDomains)
  const frameSources = toCspSources(declared?.frameDomains)
  const baseUriSources = toCspSources(declared?.baseUriDomains)

  return [
    "default-src 'none'",
    directive("script-src", ["'self'", "'unsafe-inline'", ...resourceSources]),
    directive("style-src", ["'self'", "'unsafe-inline'", ...resourceSources]),
    directive("img-src", ["'self'", "data:", ...resourceSources]),
    directive("font-src", ["'self'", ...resourceSources]),
    directive("media-src", ["'self'", "data:", ...resourceSources]),
    directive("connect-src", connectSources.length > 0 ? connectSources : ["'none'"]),
    directive("frame-src", frameSources.length > 0 ? frameSources : ["'none'"]),
    directive("base-uri", baseUriSources.length > 0 ? baseUriSources : ["'self'"]),
    "object-src 'none'",
    "form-action 'none'",
  ].join("; ")
}

const LEADING_DOCTYPE_PATTERN = /^﻿?\s*<!doctype[^>]*>/i

/**
 * The app's HTML with the policy as its first element. A `<meta>` before `<html>` still lands
 * in `<head>`, and nothing the app wrote runs before it. A policy the app adds itself can only
 * narrow this one: the browser enforces every policy of the page.
 */
export function withMcpAppCsp(html: string, policy: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`
  const doctype = LEADING_DOCTYPE_PATTERN.exec(html)
  if (!doctype) return `${meta}${html}`
  return `${doctype[0]}${meta}${html.slice(doctype[0].length)}`
}
