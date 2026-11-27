import { isIP } from "node:net"
import { Injectable, type OnModuleDestroy } from "@nestjs/common"
import { Agent, fetch } from "undici"
import { createPublicAddressLookup } from "@/common/network/public-address"

const FETCH_TIMEOUT_MS = 5_000
const MAX_DOCUMENT_BYTES = 5 * 1024

export class ClientMetadataDocumentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ClientMetadataDocumentError"
  }
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
 * Resolves the name, refuses private addresses, and hands the connection the
 * addresses it checked, so a second DNS answer cannot point elsewhere.
 */
const safeLookup = createPublicAddressLookup({
  refusal: (message) => new ClientMetadataDocumentError(message),
})

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
