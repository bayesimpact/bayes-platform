import { SdkErrorCode, SdkHttpError } from "@modelcontextprotocol/client"
import {
  describeMcpConnectionError,
  McpAddressNotAllowedError,
  McpConnectionTimeoutError,
} from "./mcp-connection-error"

describe("describeMcpConnectionError", () => {
  it("reads a 401 from the transport message", () => {
    const error = new Error(
      'MCP HTTP Transport Error: POSTing to endpoint (HTTP 401): {"error":"invalid_token"}',
    )
    expect(describeMcpConnectionError(error)).toMatchObject({
      code: "unauthorized",
      httpStatus: 401,
    })
  })

  it("maps 403, 404 and other statuses", () => {
    const describeStatus = (status: number) =>
      describeMcpConnectionError(
        new Error(`MCP HTTP Transport Error: POSTing to endpoint (HTTP ${status}): nope`),
      )
    expect(describeStatus(403)).toMatchObject({ code: "forbidden", httpStatus: 403 })
    expect(describeStatus(404)).toMatchObject({ code: "notFound", httpStatus: 404 })
    expect(describeStatus(405)).toMatchObject({ code: "notFound", httpStatus: 405 })
    expect(describeStatus(502)).toMatchObject({ code: "httpError", httpStatus: 502 })
  })

  it("treats the client's UnauthorizedError as a 401", () => {
    const error = new Error("Unauthorized")
    error.name = "UnauthorizedError"
    expect(describeMcpConnectionError(error)).toMatchObject({ code: "unauthorized" })
  })

  it("finds a DNS failure under fetch's cause", () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND mcp.example.test"), {
      code: "ENOTFOUND",
    })
    const described = describeMcpConnectionError(new TypeError("fetch failed", { cause }))
    expect(described.code).toBe("unreachable")
    expect(described.detail).toContain("ENOTFOUND")
  })

  it("reports a timeout", () => {
    expect(describeMcpConnectionError(new McpConnectionTimeoutError(10_000))).toMatchObject({
      code: "timeout",
      detail: "The server did not answer within 10 seconds",
    })
    const cause = Object.assign(new Error("connect timeout"), { code: "UND_ERR_CONNECT_TIMEOUT" })
    expect(describeMcpConnectionError(new TypeError("fetch failed", { cause })).code).toBe(
      "timeout",
    )
  })

  it("reports an answer that is not MCP", () => {
    const error = new Error("MCP HTTP Transport Error: Unexpected content type: text/html")
    expect(describeMcpConnectionError(error)).toMatchObject({ code: "notMcp", httpStatus: null })
  })

  it("shortens a long response body to one line", () => {
    const error = new Error(
      `MCP HTTP Transport Error: POSTing to endpoint (HTTP 500): ${"<html>\n".repeat(200)}`,
    )
    const { detail } = describeMcpConnectionError(error)
    expect(detail.length).toBeLessThanOrEqual(301)
    expect(detail).not.toContain("\n")
  })

  it("falls back to unknown", () => {
    expect(describeMcpConnectionError(new Error("boom"))).toEqual({
      code: "unknown",
      httpStatus: null,
      detail: "boom",
    })
  })

  it("reads the status of the SdkHttpError of the transport of public servers", () => {
    const error = new SdkHttpError(
      SdkErrorCode.ClientHttpFailedToOpenStream,
      "Failed to open SSE stream: Forbidden",
      { status: 403, statusText: "Forbidden" },
    )
    expect(describeMcpConnectionError(error)).toMatchObject({ code: "forbidden", httpStatus: 403 })
  })

  it("reports a refused address, even under the cause fetch wraps it in", () => {
    const error = new TypeError("fetch failed", {
      cause: new McpAddressNotAllowedError(
        "The host rebinding.example.test is not a public address",
      ),
    })
    expect(describeMcpConnectionError(error)).toEqual({
      code: "urlNotAllowed",
      httpStatus: null,
      detail: "The host rebinding.example.test is not a public address",
    })
  })
})
