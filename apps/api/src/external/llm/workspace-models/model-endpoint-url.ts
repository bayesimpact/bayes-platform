import { lookup as dnsLookup, type LookupAddress } from "node:dns"
import { lookup } from "node:dns/promises"
import { BlockList, isIP, type LookupFunction } from "node:net"

/**
 * Set to "true" to accept http and private addresses, for a vLLM server on the developer's
 * machine or the local network. Never in a deployed environment.
 */
export const ALLOW_PRIVATE_MODEL_ENDPOINTS_ENV = "MODEL_ENDPOINTS_ALLOW_PRIVATE_URLS"

/**
 * IPv4 ranges a model server is never reached on: unspecified, private, shared (CGNAT),
 * loopback, link-local (cloud metadata), IETF protocol assignments, the 6to4 relay, benchmark,
 * multicast, reserved and broadcast.
 */
const PRIVATE_IPV4 = new BlockList()
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  PRIVATE_IPV4.addSubnet(network, prefix, "ipv4")
}

/** Global unicast (2000::/3) is the only IPv6 space a model server is reached on. */
const GLOBAL_UNICAST_IPV6 = new BlockList()
GLOBAL_UNICAST_IPV6.addSubnet("2000::", 3, "ipv6")

export class InvalidModelEndpointUrlError extends Error {}

type ResolveHost = (hostname: string) => Promise<string[]>

const resolveWithDns: ResolveHost = async (hostname) =>
  (await lookup(hostname, { all: true })).map((entry) => entry.address)

/**
 * Checks that a model server URL is safe to call from the API: https, no credentials, and a host
 * that resolves only to public addresses, so the URL cannot reach the cluster or the cloud
 * metadata server. Returns the URL as `URL` writes it. The check runs before the call: the
 * connection checks the address again ({@link modelEndpointLookup}).
 */
export async function assertSafeModelEndpointUrl(
  rawUrl: string,
  options: { allowPrivate?: boolean; resolveHost?: ResolveHost } = {},
): Promise<string> {
  const allowPrivate = options.allowPrivate ?? isPrivateModelEndpointAllowed()
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new InvalidModelEndpointUrlError("The URL is not valid")
  }
  if (url.protocol !== "https:" && !(allowPrivate && url.protocol === "http:")) {
    throw new InvalidModelEndpointUrlError("The URL must use https")
  }
  if (url.username || url.password) {
    throw new InvalidModelEndpointUrlError("The URL must not hold credentials")
  }
  if (!allowPrivate) {
    const hostname = toBareHostname(url)
    const addresses = isIP(hostname)
      ? [hostname]
      : await (options.resolveHost ?? resolveWithDns)(hostname).catch(() => {
          throw new InvalidModelEndpointUrlError(`The host ${hostname} cannot be resolved`)
        })
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
      throw new InvalidModelEndpointUrlError(`The host ${hostname} is not a public address`)
    }
  }
  return url.toString()
}

/**
 * Throws unless the host of a request to a model server is a name or a public address. A name is
 * checked when the connection resolves it ({@link modelEndpointLookup}), but Node does not resolve
 * an address, so an address is checked here.
 */
export function assertModelEndpointRequestHost(
  requestUrl: string,
  options: { allowPrivate?: boolean } = {},
): void {
  if (options.allowPrivate ?? isPrivateModelEndpointAllowed()) return
  const hostname = toBareHostname(new URL(requestUrl))
  if (isIP(hostname) && isPrivateAddress(hostname)) {
    throw new InvalidModelEndpointUrlError(`The host ${hostname} is not a public address`)
  }
}

/**
 * The DNS lookup of a connection to a model server. It refuses a name that resolves to a private
 * address and hands the connection the addresses it checked, so a DNS answer that changed after
 * {@link assertSafeModelEndpointUrl} cannot lead the call into the cluster.
 */
export const modelEndpointLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, [])
    if (
      !isPrivateModelEndpointAllowed() &&
      (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address)))
    ) {
      return callback(
        new InvalidModelEndpointUrlError(`The host ${hostname} is not a public address`),
        [],
      )
    }
    if (options.all) return callback(null, addresses)
    const [first] = addresses
    if (!first) return callback(new InvalidModelEndpointUrlError(`No address for ${hostname}`), [])
    callback(null, first.address, first.family)
  })
}

/**
 * True for every address a model server must not be reached on. An IPv6 address is public only in
 * global unicast (2000::/3). An IPv6 address that carries an IPv4 address (IPv4-mapped, 6to4) is
 * judged by that IPv4 address. IPv4-compatible, NAT64, site-local, unique-local, link-local and
 * multicast addresses fall outside global unicast. Teredo (2001::/32) is refused, since it tunnels
 * to an IPv4 address. Anything that is not an address counts as private.
 */
export function isPrivateAddress(address: string): boolean {
  const bareAddress = address.split("%")[0] ?? address
  const family = isIP(bareAddress)
  if (family === 4) return PRIVATE_IPV4.check(bareAddress, "ipv4")
  if (family !== 6) return true
  const groups = parseIpv6Groups(bareAddress)
  if (!groups) return true
  const [group0, group1, group2, group3, group4, group5, group6, group7] = groups
  const isIpv4Mapped =
    group0 === 0 &&
    group1 === 0 &&
    group2 === 0 &&
    group3 === 0 &&
    group4 === 0 &&
    group5 === 0xffff
  if (isIpv4Mapped) return PRIVATE_IPV4.check(ipv4FromGroups(group6, group7), "ipv4")
  if (!GLOBAL_UNICAST_IPV6.check(bareAddress, "ipv6")) return true
  if (group0 === 0x2002) return PRIVATE_IPV4.check(ipv4FromGroups(group1, group2), "ipv4")
  if (group0 === 0x2001 && group1 === 0) return true
  return false
}

/** The eight 16-bit groups of an IPv6 address `isIP` accepts, or null. */
function parseIpv6Groups(address: string): number[] | null {
  let text = address.toLowerCase()
  const lastColon = text.lastIndexOf(":")
  const tail = text.slice(lastColon + 1)
  if (tail.includes(".")) {
    const octets = tail.split(".").map(Number)
    if (octets.length !== 4 || octets.some((octet) => !(octet >= 0 && octet <= 255))) return null
    const [octet0 = 0, octet1 = 0, octet2 = 0, octet3 = 0] = octets
    text = `${text.slice(0, lastColon + 1)}${((octet0 << 8) | octet1).toString(16)}:${((octet2 << 8) | octet3).toString(16)}`
  }
  const halves = text.split("::")
  if (halves.length > 2) return null
  const toGroups = (part: string) =>
    part === "" ? [] : part.split(":").map((group) => Number.parseInt(group, 16))
  const head = toGroups(halves[0] ?? "")
  const rest = halves.length === 2 ? toGroups(halves[1] ?? "") : []
  const missing = 8 - head.length - rest.length
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null
  const groups = [...head, ...new Array<number>(missing).fill(0), ...rest]
  return groups.every((group) => group >= 0 && group <= 0xffff) ? groups : null
}

function ipv4FromGroups(high = 0, low = 0): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".")
}

function toBareHostname(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, "")
}

function isPrivateModelEndpointAllowed(): boolean {
  return process.env[ALLOW_PRIVATE_MODEL_ENDPOINTS_ENV] === "true"
}
