/**
 * SSRF guard for outbound requests whose destination comes from user input
 * or from a third-party server's response (MCP URL, OAuth discovery
 * documents). Rejects anything that is not public https, resolving hostnames
 * through DNS so a public name pointing at an internal address is caught too.
 *
 * Set MCP_OAUTH_ALLOW_INSECURE_LOCAL=true in local development to keep
 * http://localhost servers working; the flag never relaxes the check for any
 * other host.
 */

import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { isPrivateAddress } from "@/common/network/public-address"

export class DisallowedOutboundUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DisallowedOutboundUrlError"
  }
}

const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

function isInsecureLocalAllowed(): boolean {
  return process.env.MCP_OAUTH_ALLOW_INSECURE_LOCAL === "true"
}

function isLocalhostName(hostname: string): boolean {
  return LOCALHOST_NAMES.has(hostname.toLowerCase())
}

/**
 * True for an http or https URL at localhost, 127.0.0.1 or ::1 while
 * MCP_OAUTH_ALLOW_INSECURE_LOCAL=true: the one case where a server may sit on
 * a private address.
 */
export function isInsecureLocalUrl(candidate: string): boolean {
  if (!isInsecureLocalAllowed()) return false
  try {
    const url = new URL(candidate)
    return (url.protocol === "http:" || url.protocol === "https:") && isLocalhostName(url.hostname)
  } catch {
    return false
  }
}

/**
 * Throws DisallowedOutboundUrlError unless `candidate` is an https URL whose
 * host resolves only to public addresses. With
 * MCP_OAUTH_ALLOW_INSECURE_LOCAL=true, http and loopback are also accepted
 * for localhost, 127.0.0.1 and ::1 only.
 */
export async function assertAllowedOutboundUrl(candidate: string): Promise<void> {
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new DisallowedOutboundUrlError("URL is not parseable")
  }
  const hostname = url.hostname
  if (isInsecureLocalAllowed() && isLocalhostName(hostname)) {
    if (url.protocol === "https:" || url.protocol === "http:") return
    throw new DisallowedOutboundUrlError(`URL scheme ${url.protocol} is not allowed`)
  }
  if (url.protocol !== "https:") {
    throw new DisallowedOutboundUrlError(`URL scheme ${url.protocol} is not allowed`)
  }
  if (hostname === "") throw new DisallowedOutboundUrlError("URL has no host")

  if (isIP(hostname.replace(/^\[|\]$/g, "")) !== 0) {
    if (isPrivateAddress(hostname)) {
      throw new DisallowedOutboundUrlError(`Host ${hostname} is a private or local address`)
    }
    return
  }

  let addresses: { address: string }[]
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    throw new DisallowedOutboundUrlError(`Host ${hostname} could not be resolved`)
  }
  if (addresses.length === 0) {
    throw new DisallowedOutboundUrlError(`Host ${hostname} could not be resolved`)
  }
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new DisallowedOutboundUrlError(`Host ${hostname} resolves to a private or local address`)
  }
}

/** Boolean form of assertAllowedOutboundUrl for callers that skip rather than fail. */
export async function isAllowedOutboundUrl(candidate: string): Promise<boolean> {
  try {
    await assertAllowedOutboundUrl(candidate)
    return true
  } catch (error) {
    if (error instanceof DisallowedOutboundUrlError) return false
    throw error
  }
}
