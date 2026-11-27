import { lookup as dnsLookup, type LookupAddress } from "node:dns"
import { BlockList, isIP, type LookupFunction } from "node:net"

/**
 * IPv4 ranges an outbound request whose destination comes from outside the platform never
 * reaches: unspecified, private, shared (CGNAT), loopback, link-local (cloud metadata), IETF
 * protocol assignments, the 6to4 relay, benchmark, multicast, reserved and broadcast.
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

/** Global unicast (2000::/3) is the only IPv6 space an outbound request reaches. */
const GLOBAL_UNICAST_IPV6 = new BlockList()
GLOBAL_UNICAST_IPV6.addSubnet("2000::", 3, "ipv6")

/**
 * True for every address an outbound request whose destination comes from outside the platform
 * must not reach. An IPv6 address is public only in global unicast (2000::/3). An IPv6 address
 * that carries an IPv4 address (IPv4-mapped, 6to4) is judged by that IPv4 address.
 * IPv4-compatible, NAT64, site-local, unique-local, link-local and multicast addresses fall
 * outside global unicast. Teredo (2001::/32) is refused, since it tunnels to an IPv4 address.
 * Square brackets and a zone index are ignored. Anything that is not an address counts as private.
 */
export function isPrivateAddress(address: string): boolean {
  const unbracketed =
    address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address
  const bareAddress = unbracketed.split("%")[0] ?? unbracketed
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

/**
 * The DNS lookup of a connection that must reach only public addresses. It refuses a name that
 * resolves to a private address and hands the connection the addresses it checked, so a DNS
 * answer that changed after an earlier check cannot lead the request into the cluster.
 * `allowPrivate` is read at each lookup; `refusal` builds the error of a refused name.
 */
export function createPublicAddressLookup({
  allowPrivate = () => false,
  refusal,
}: {
  allowPrivate?: (hostname: string) => boolean
  refusal: (message: string) => Error
}): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
      if (error) return callback(error, [])
      if (
        !allowPrivate(hostname) &&
        (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address)))
      ) {
        return callback(refusal(`The host ${hostname} is not a public address`), [])
      }
      if (options.all) return callback(null, addresses)
      const [first] = addresses
      if (!first) return callback(refusal(`No address for ${hostname}`), [])
      callback(null, first.address, first.family)
    })
  }
}

/** The host of a URL, without the square brackets of an IPv6 address. */
export function toBareHostname(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, "")
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
