import type { ApiRoute } from "@bayes-platform/api-contracts"
import type { INestApplication } from "@nestjs/common/interfaces"
import request from "supertest"
import type { App } from "supertest/types"

// Helper function to make authenticated requests in tests
export const testRequester =
  (app: INestApplication<App>) =>
  async <T extends ApiRoute>(params: {
    route: T
    pathParams?: Record<string, string>
    token?: string
    /** Query string for GET (and other methods that support it). Values should be strings. */
    query?: Record<string, string>
    request?: T["request"]
  }): Promise<Omit<request.Response, "body"> & { body: T["response"] }> => {
    const { token, route } = params
    const { method, getPath } = route

    const path = getPath(params.pathParams)

    // Avoid pooled keep-alive connections: under a full suite load, reuse can
    // rarely yield ECONNRESET / "socket hang up" (notably on SSE routes).
    const req = request(app.getHttpServer())[method](path).set("Connection", "close")

    if (params.query) {
      req.query(params.query)
    }

    if (
      "request" in params &&
      params.request &&
      "payload" in params.request &&
      params.request.payload
    ) {
      req.send(params.request)
    }

    // Add Authorization header if token is provided
    if (token) req.set("Authorization", `Bearer ${token}`)

    return (await req) as Omit<request.Response, "body"> & {
      body: T["response"]
    }
  }

export type Requester = ReturnType<typeof testRequester>

const parseErrorMessageFromRawText = (rawText: unknown): string | undefined => {
  if (typeof rawText !== "string") return undefined
  if (!rawText) return undefined

  try {
    const parsedBody = JSON.parse(rawText) as { message?: unknown }
    if (typeof parsedBody.message === "string") return parsedBody.message
  } catch {
    // Not JSON, continue with plain text fallback.
  }

  const trimmedText = rawText.trim()
  return trimmedText || undefined
}

const getErrorMessageFromResponse = (res: request.Response): string | undefined => {
  const responseBody = res.body as unknown

  if (
    typeof responseBody === "object" &&
    responseBody !== null &&
    "message" in responseBody &&
    typeof responseBody.message === "string"
  ) {
    return responseBody.message
  }

  const errorMessageFromText = parseErrorMessageFromRawText(res.text)
  if (errorMessageFromText) return errorMessageFromText

  return parseErrorMessageFromRawText((res.error as { text?: unknown } | undefined)?.text)
}

export const expectErrorResponse = (res: request.Response, status: number, message: string) => {
  expect(res.status).toBe(status)
  const errorMessage = getErrorMessageFromResponse(res)
  expect(errorMessage).toBe(message)
}

export const expectResponse = (
  res: request.Response,
  status: number = 200,
  errorMessage?: string,
) => {
  if (errorMessage) {
    expectErrorResponse(res, status, errorMessage)
    return
  }
  expect(res.status).toBe(status)
}
