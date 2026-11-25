import { lookup } from "node:dns/promises"
import { BlockList, isIP } from "node:net"

/**
 * Set to "true" to accept http and private addresses, for a vLLM server on the developer's
 * machine or the local network. Never in a deployed environment.
 */
export const ALLOW_PRIVATE_MODEL_ENDPOINTS_ENV = "MODEL_ENDPOINTS_ALLOW_PRIVATE_URLS"

/** Loopback, private, link-local (cloud metadata), shared and unspecified ranges. */
const PRIVATE_ADDRESSES = new BlockList()
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
] as const) {
  PRIVATE_ADDRESSES.addSubnet(network, prefix, "ipv4")
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
] as const) {
  PRIVATE_ADDRESSES.addSubnet(network, prefix, "ipv6")
}

export class InvalidModelEndpointUrlError extends Error {}

type ResolveHost = (hostname: string) => Promise<string[]>

const resolveWithDns: ResolveHost = async (hostname) =>
  (await lookup(hostname, { all: true })).map((entry) => entry.address)

/**
 * Checks that a model server URL is safe to call from the API: https, no credentials, and a host
 * that resolves only to public addresses, so the URL cannot reach the cluster or the cloud
 * metadata server. Returns the URL as `URL` writes it.
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
    const hostname = url.hostname.replace(/^\[|\]$/g, "")
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

export function isPrivateAddress(address: string): boolean {
  const mappedIpv4 = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  if (mappedIpv4) return isPrivateAddress(mappedIpv4)
  const family = isIP(address)
  if (family === 0) return true
  return PRIVATE_ADDRESSES.check(address, family === 4 ? "ipv4" : "ipv6")
}

function isPrivateModelEndpointAllowed(): boolean {
  return process.env[ALLOW_PRIVATE_MODEL_ENDPOINTS_ENV] === "true"
}
