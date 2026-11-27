import { lookup } from "node:dns/promises"
import { isIP, type LookupFunction } from "node:net"
import {
  createPublicAddressLookup,
  isPrivateAddress,
  toBareHostname,
} from "@/common/network/public-address"

/**
 * Set to "true" to accept http and private addresses, for a vLLM server on the developer's
 * machine or the local network. Never in a deployed environment. Named like
 * MCP_OAUTH_ALLOW_INSECURE_LOCAL, its counterpart for MCP servers.
 */
export const ALLOW_INSECURE_LOCAL_MODEL_ENDPOINTS_ENV = "MODEL_ENDPOINTS_ALLOW_INSECURE_LOCAL"

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
export const modelEndpointLookup: LookupFunction = createPublicAddressLookup({
  allowPrivate: () => isPrivateModelEndpointAllowed(),
  refusal: (message) => new InvalidModelEndpointUrlError(message),
})

function isPrivateModelEndpointAllowed(): boolean {
  return process.env[ALLOW_INSECURE_LOCAL_MODEL_ENDPOINTS_ENV] === "true"
}
