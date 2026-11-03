import { EventEmitter } from "node:events"
import { Logger } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"
import { RequestLoggerMiddleware } from "./request-logger.middleware"

describe("RequestLoggerMiddleware", () => {
  let debugSpy: jest.SpyInstance

  beforeEach(() => {
    debugSpy = jest.spyOn(Logger.prototype, "debug").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const handle = ({
    method,
    originalUrl,
    query = {},
    body = {},
    statusCode = 200,
  }: {
    method: string
    originalUrl: string
    query?: Record<string, unknown>
    body?: Record<string, unknown>
    statusCode?: number
  }) => {
    const request = { method, originalUrl, query, body } as unknown as Request
    const response = Object.assign(new EventEmitter(), { statusCode }) as unknown as Response
    const next: NextFunction = jest.fn()

    new RequestLoggerMiddleware().use(request, response, next)
    response.emit("finish")

    return {
      next,
      loggedLines: debugSpy.mock.calls.map(([message]) => String(message)),
    }
  }

  it("logs the method, the path, the status and the duration", () => {
    const { next, loggedLines } = handle({
      method: "POST",
      originalUrl: "/api/invitations",
      statusCode: 201,
    })

    expect(next).toHaveBeenCalled()
    expect(loggedLines[0]).toBe("--> POST /api/invitations")
    expect(loggedLines[1]).toMatch(/^<-- POST \/api\/invitations 201 \d+ms$/)
  })

  it("never logs the message of a stream sent in the query string", () => {
    const message = "Where is my order?"
    const { loggedLines } = handle({
      method: "GET",
      originalUrl: `/api/public/v1/agents/embed-token/sessions/session-id/messages/stream?q=${encodeURIComponent(JSON.stringify({ payload: { content: message } }))}`,
      query: { q: JSON.stringify({ payload: { content: message } }) },
    })

    expect(loggedLines).toHaveLength(2)
    for (const line of loggedLines) {
      expect(line).not.toContain("?")
      expect(line).not.toContain("Where")
      expect(line).toContain("/messages/stream")
    }
  })

  it("never logs the message of a stream sent in the body", () => {
    const { loggedLines } = handle({
      method: "POST",
      originalUrl: "/api/organizations/org-id/agent-sessions/live/session-id/stream",
      body: { payload: { content: "Where is my order?" } },
    })

    expect(loggedLines).toHaveLength(2)
    for (const line of loggedLines) {
      expect(line).not.toContain("Where")
      expect(line).not.toContain("payload")
    }
  })

  it("never logs credentials sent in the query string or the body", () => {
    const { loggedLines } = handle({
      method: "POST",
      originalUrl: "/api/oauth/token?code=one-time-code",
      query: { code: "one-time-code" },
      body: { refresh_token: "secret-refresh" },
    })

    for (const line of loggedLines) {
      expect(line).not.toContain("one-time-code")
      expect(line).not.toContain("secret-refresh")
    }
  })
})
