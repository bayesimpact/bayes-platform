import type {
  McpServerConnectionErrorCode,
  McpServerConnectionErrorDto,
} from "@caseai-connect/api-contracts"

const MAX_DETAIL_LENGTH = 300

/** Node network error codes that mean the host could not be reached at all. */
const UNREACHABLE_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
])
const TIMEOUT_CODES = new Set(["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"])

export class McpConnectionTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`The server did not answer within ${Math.round(timeoutMs / 1000)} seconds`)
    this.name = "McpConnectionTimeoutError"
  }
}

function codeForHttpStatus(httpStatus: number): McpServerConnectionErrorCode {
  if (httpStatus === 401) return "unauthorized"
  if (httpStatus === 403) return "forbidden"
  if (httpStatus === 404 || httpStatus === 405) return "notFound"
  return "httpError"
}

/** The network error code, which fetch hides one or two `cause` levels down. */
function findNetworkCode(error: unknown, depth = 0): string | null {
  if (!(error instanceof Error) || depth > 3) return null
  const code = (error as Error & { code?: unknown }).code
  if (typeof code === "string") return code
  return findNetworkCode(error.cause, depth + 1)
}

function shorten(text: string): string {
  const singleLine = text.replace(/\s+/g, " ").trim()
  return singleLine.length > MAX_DETAIL_LENGTH
    ? `${singleLine.slice(0, MAX_DETAIL_LENGTH)}…`
    : singleLine
}

/**
 * Turns whatever the MCP client threw into a code the UI can explain.
 * `@ai-sdk/mcp` throws plain `MCPClientError`s whose only structured part is
 * the message, so the HTTP status is read from it.
 */
export function describeMcpConnectionError(error: unknown): McpServerConnectionErrorDto {
  const message = error instanceof Error ? error.message : String(error)
  const detail = shorten(message)

  if (error instanceof McpConnectionTimeoutError) {
    return { code: "timeout", httpStatus: null, detail }
  }
  if (error instanceof Error && error.name === "UnauthorizedError") {
    return { code: "unauthorized", httpStatus: 401, detail }
  }

  const httpStatusMatch = /\(HTTP (\d{3})\)|GET SSE failed: (\d{3})/.exec(message)
  const httpStatusText = httpStatusMatch?.[1] ?? httpStatusMatch?.[2]
  if (httpStatusText) {
    const httpStatus = Number(httpStatusText)
    return { code: codeForHttpStatus(httpStatus), httpStatus, detail }
  }

  const networkCode = findNetworkCode(error)
  if (networkCode && TIMEOUT_CODES.has(networkCode)) {
    return { code: "timeout", httpStatus: null, detail: shorten(`${message} (${networkCode})`) }
  }
  if (networkCode && UNREACHABLE_CODES.has(networkCode)) {
    return { code: "unreachable", httpStatus: null, detail: shorten(`${message} (${networkCode})`) }
  }
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return { code: "timeout", httpStatus: null, detail }
  }
  if (error instanceof TypeError && /fetch failed/i.test(message)) {
    return { code: "unreachable", httpStatus: null, detail }
  }

  // The host answered 2xx, but not with MCP: an HTML page, a JSON body that is
  // not JSON-RPC, an initialize result the client cannot read.
  const isProtocolError =
    /Unexpected content type|invalid initialize result|protocol version is not supported|does not support tools|JSON/i.test(
      message,
    ) ||
    (error instanceof Error && (error.name === "ZodError" || error.name === "SyntaxError"))
  if (isProtocolError) return { code: "notMcp", httpStatus: null, detail }

  return { code: "unknown", httpStatus: null, detail }
}
