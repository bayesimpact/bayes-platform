import type { ArgumentsHost } from "@nestjs/common"
import { HttpException } from "@nestjs/common"
import { OAuthProtocolError, OAuthProtocolErrorFilter } from "./oauth-protocol.error"

function respondTo(exception: unknown) {
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(body: unknown) {
      this.body = body
    },
  }
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost
  new OAuthProtocolErrorFilter().catch(exception, host)
  return response
}

describe("OAuthProtocolErrorFilter", () => {
  it("answers protocol errors with their code", () => {
    const response = respondTo(new OAuthProtocolError("invalid_grant"))

    expect(response.statusCode).toBe(400)
    expect(response.body).toEqual({ error: "invalid_grant" })
    expect(response.headers["Cache-Control"]).toBe("no-store")
  })

  it("answers rate limits with slow_down", () => {
    const response = respondTo(new HttpException("Too Many Requests", 429))

    expect(response.statusCode).toBe(429)
    expect(response.body).toMatchObject({ error: "slow_down" })
  })

  it("answers a server fault with server_error, without its details", () => {
    const response = respondTo(new Error("error:1E08010C:DECODER routines::unsupported"))

    expect(response.statusCode).toBe(500)
    expect(response.body).toEqual({ error: "server_error" })
  })
})
