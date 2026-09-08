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

function parseIpv4(address: string): number[] | null {
  const octets = address.split(".")
  if (octets.length !== 4) return null
  const values = octets.map((octet) => (/^\d{1,3}$/.test(octet) ? Number(octet) : Number.NaN))
  return values.every((value) => value >= 0 && value <= 255) ? values : null
}

function isPrivateIpv4(octets: number[]): boolean {
  const [first, second] = octets as [number, number, number, number]
  if (first === 0) return true // 0.0.0.0/8 (unspecified, "this host")
  if (first === 10) return true // RFC 1918
  if (first === 127) return true // loopback
  if (first === 169 && second === 254) return true // link-local, cloud metadata
  if (first === 172 && second >= 16 && second <= 31) return true // RFC 1918
  if (first === 192 && second === 168) return true // RFC 1918
  return false
}

/** Expands an IPv6 literal into its eight 16-bit groups, or null if malformed. */
function parseIpv6(address: string): number[] | null {
  let text = address
  // Trailing dotted-quad form (::ffff:127.0.0.1): fold it into two hex groups.
  const lastColon = text.lastIndexOf(":")
  const tail = text.slice(lastColon + 1)
  if (tail.includes(".")) {
    const octets = parseIpv4(tail)
    if (!octets) return null
    const [a, b, c, d] = octets as [number, number, number, number]
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const halves = text.split("::")
  if (halves.length > 2) return null
  const toGroups = (part: string): number[] | null => {
    if (part === "") return []
    const groups = part
      .split(":")
      .map((group) => (/^[0-9a-f]{1,4}$/i.test(group) ? Number.parseInt(group, 16) : Number.NaN))
    return groups.some(Number.isNaN) ? null : groups
  }
  const head = toGroups(halves[0] ?? "")
  const rest = halves.length === 2 ? toGroups(halves[1] ?? "") : []
  if (!head || !rest) return null
  const missing = 8 - head.length - rest.length
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null
  return [...head, ...new Array<number>(missing).fill(0), ...rest]
}

function isPrivateIpv6(groups: number[]): boolean {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  const isMapped = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff
  if (isMapped) {
    return isPrivateIpv4([g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff])
  }
  const allZeroPrefix =
    g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0
  if (allZeroPrefix && (g7 === 0 || g7 === 1)) return true // :: and ::1
  if ((g0 & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((g0 & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
  return false
}

/**
 * True for loopback, unspecified, RFC 1918, link-local, unique-local and
 * IPv4-mapped equivalents. Unparseable input counts as private so a malformed
 * literal is never fetched.
 */
export function isPrivateOrLocalAddress(address: string): boolean {
  const bare = address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address
  const zoneStripped = bare.split("%")[0] ?? bare
  const family = isIP(zoneStripped)
  if (family === 4) {
    const octets = parseIpv4(zoneStripped)
    return octets ? isPrivateIpv4(octets) : true
  }
  if (family === 6) {
    const groups = parseIpv6(zoneStripped)
    return groups ? isPrivateIpv6(groups) : true
  }
  return true
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
    if (isPrivateOrLocalAddress(hostname)) {
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
  if (addresses.some((entry) => isPrivateOrLocalAddress(entry.address))) {
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
