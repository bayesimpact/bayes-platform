import { type LookupAddress, lookup } from "node:dns"
import { BlockList, isIP, type LookupFunction } from "node:net"
import { Injectable, type OnModuleDestroy } from "@nestjs/common"
import { Agent, fetch } from "undici"

const FETCH_TIMEOUT_MS = 5_000
const MAX_DOCUMENT_BYTES = 5 * 1024

/** Addresses a metadata document is never fetched from: private, loopback, link-local, reserved. */
const blockedAddresses = new BlockList()
for (const subnet of [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
]) {
  const [network, prefix] = subnet.split("/")
  blockedAddresses.addSubnet(network!, Number(prefix), "ipv4")
}
for (const subnet of [
  "::/127",
  "64:ff9b::/96",
  "100::/64",
  "2001:db8::/32",
  "fc00::/7",
  "fe80::/10",
  "ff00::/8",
]) {
  const [network, prefix] = subnet.split("/")
  blockedAddresses.addSubnet(network!, Number(prefix), "ipv6")
}

export class ClientMetadataDocumentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ClientMetadataDocumentError"
  }
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return blockedAddresses.check(address, "ipv4")
  if (family !== 6) return true
  // An IPv4-mapped IPv6 address (::ffff:10.0.0.1) is checked as the IPv4 address it carries.
  const mappedIpv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1]
  if (mappedIpv4) return blockedAddresses.check(mappedIpv4, "ipv4")
  return blockedAddresses.check(address, "ipv6")
}

/**
 * A client id is a metadata document URL when it is `https`, on the default
 * port, with a path, and names a host rather than an address.
 */
export function parseClientMetadataDocumentUrl(clientId: string): URL | null {
  let url: URL
  try {
    url = new URL(clientId)
  } catch {
    return null
  }
  const isValid =
    url.protocol === "https:" &&
    url.port === "" &&
    url.pathname !== "/" &&
    !url.hash &&
    !url.username &&
    !url.password &&
    isIP(url.hostname.replace(/^\[|\]$/g, "")) === 0
  return isValid ? url : null
}

/**
 * Resolves the name, refuses blocked addresses, and hands the connection the
 * addresses it checked, so a second DNS answer cannot point elsewhere.
 */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, [])
    if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
      return callback(
        new ClientMetadataDocumentError(`${hostname} resolves to a blocked address`),
        [],
      )
    }
    if (options.all) return callback(null, addresses)
    const [first] = addresses
    callback(null, first!.address, first!.family)
  })
}

/**
 * Fetches client ID metadata documents (CIMD). The URL comes from outside the
 * platform, so the request is a possible SSRF and is fenced in (ADR 0028).
 */
@Injectable()
export class ClientMetadataDocumentFetcher implements OnModuleDestroy {
  private readonly agent = new Agent({
    connect: { lookup: safeLookup, timeout: FETCH_TIMEOUT_MS },
    headersTimeout: FETCH_TIMEOUT_MS,
    bodyTimeout: FETCH_TIMEOUT_MS,
  })

  async fetchDocument(url: URL): Promise<unknown> {
    let response: Awaited<ReturnType<typeof fetch>>
    try {
      response = await fetch(url, {
        dispatcher: this.agent,
        redirect: "manual",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
    } catch (error) {
      throw new ClientMetadataDocumentError(
        `Could not fetch the client metadata document: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (response.status !== 200) {
      await response.body?.cancel()
      throw new ClientMetadataDocumentError(
        `The client metadata document answered ${response.status}`,
      )
    }
    const text = await readLimited(response, MAX_DOCUMENT_BYTES)
    try {
      return JSON.parse(text)
    } catch {
      throw new ClientMetadataDocumentError("The client metadata document is not JSON")
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.agent.closed || this.agent.destroyed) return
    await this.agent.close()
  }
}

async function readLimited(
  response: Awaited<ReturnType<typeof fetch>>,
  maxBytes: number,
): Promise<string> {
  if (!response.body) return ""
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.byteLength
    if (size > maxBytes) {
      await response.body.cancel()
      throw new ClientMetadataDocumentError("The client metadata document is too large")
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString("utf8")
}
