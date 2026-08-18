import dns from "node:dns"
import ipaddr from "ipaddr.js"

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"])

export class UnsafeCrawlUrlError extends Error {}

export function assertIpIsSafe(ipAddress: string): void {
  const range = ipaddr.process(ipAddress).range()
  if (range !== "unicast") {
    throw new UnsafeCrawlUrlError(`Refusing to crawl non-public address ${ipAddress} (${range})`)
  }
}

export async function assertCrawlUrlIsSafe(url: string): Promise<void> {
  const parsedUrl = new URL(url)
  if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new UnsafeCrawlUrlError(`Refusing to crawl unsupported protocol ${parsedUrl.protocol}`)
  }

  const addresses = await dns.promises.lookup(parsedUrl.hostname, { all: true }).catch(() => {
    throw new UnsafeCrawlUrlError(`Could not resolve host ${parsedUrl.hostname}`)
  })

  for (const address of addresses) {
    assertIpIsSafe(address.address)
  }
}
