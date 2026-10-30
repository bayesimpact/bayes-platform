import { defineSchemaRoute } from "@caseai-connect/desk-contracts"
import { HttpResponse, http } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

const session = vi.hoisted(() => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
  SignInRefusedError: class SignInRefusedError extends Error {
    readonly refusal: string
    constructor(refusal: string) {
      super(refusal)
      this.refusal = refusal
    }
  },
  SignInLoopError: class SignInLoopError extends Error {},
  claimAutomaticSignIn: vi.fn(() => true),
  getAccessToken: vi.fn(),
  endSession: vi.fn(),
  signIn: vi.fn(),
}))
vi.mock("@/lib/auth/session", () => session)

const { ApiError, ContractMismatchError, apiRequest } = await import("./api-client")

const itemId = crypto.randomUUID()

const TestRoutes = {
  getItem: defineSchemaRoute({
    method: "get",
    path: "test/items/:itemId",
    params: z.strictObject({ itemId: z.uuid() }),
    query: z.strictObject({ page: z.coerce.number<string>().int().min(0) }),
    response: z.object({ itemId: z.uuid(), page: z.number() }),
  }),
  createItem: defineSchemaRoute({
    method: "post",
    path: "test/items",
    body: z.strictObject({ title: z.string() }),
    response: z.object({ title: z.string() }),
  }),
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
beforeEach(() => {
  vi.stubGlobal("window", {
    location: { origin: "http://desk.test", pathname: "/app/o/1", search: "?tab=a", hash: "" },
  })
  session.getAccessToken.mockReset().mockResolvedValue("first-token")
  session.endSession.mockReset()
  session.signIn.mockReset()
})
afterEach(() => {
  server.resetHandlers()
  vi.unstubAllGlobals()
})
afterAll(() => server.close())

describe("apiRequest", () => {
  it("calls /api on the page's origin with the bearer token, and returns the parsed data", async () => {
    let received: { url: string; authorization: string | null } | undefined
    server.use(
      http.get("http://desk.test/api/test/items/:itemId", ({ request, params }) => {
        received = { url: request.url, authorization: request.headers.get("Authorization") }
        return HttpResponse.json({ data: { itemId: params.itemId, page: 2, internalNote: "x" } })
      }),
    )

    const item = await apiRequest(TestRoutes.getItem, { params: { itemId }, query: { page: 2 } })

    expect(item).toEqual({ itemId, page: 2 })
    expect(received).toEqual({
      url: `http://desk.test/api/test/items/${itemId}?page=2`,
      authorization: "Bearer first-token",
    })
  })

  it("sends the body in its payload envelope", async () => {
    let body: unknown
    server.use(
      http.post("http://desk.test/api/test/items", async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ data: { title: "Weekly report" } })
      }),
    )

    await apiRequest(TestRoutes.createItem, { body: { title: "Weekly report" } })

    expect(body).toEqual({ payload: { title: "Weekly report" } })
  })

  it("throws an ApiError with the body of a 400", async () => {
    const message = "ZodValidationError: found 1 issues\n  [Issue 1] title:\n Too small"
    server.use(
      http.post("http://desk.test/api/test/items", () =>
        HttpResponse.json({ statusCode: 400, message, error: "Bad Request" }, { status: 400 }),
      ),
    )

    const error = await apiRequest(TestRoutes.createItem, { body: { title: "" } }).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, body: { message, error: "Bad Request" } })
  })

  it("throws a ContractMismatchError when the response breaks the contract", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.use(
      http.get("http://desk.test/api/test/items/:itemId", () =>
        HttpResponse.json({ data: { itemId: "not-a-uuid", page: 2 } }),
      ),
    )

    await expect(
      apiRequest(TestRoutes.getItem, { params: { itemId }, query: { page: 0 } }),
    ).rejects.toBeInstanceOf(ContractMismatchError)
  })

  it("refreshes the token once after a 401, then retries", async () => {
    session.getAccessToken.mockImplementation(async (options?: { forceRefresh?: boolean }) =>
      options?.forceRefresh ? "refreshed-token" : "revoked-token",
    )
    server.use(
      http.get("http://desk.test/api/test/items/:itemId", ({ request }) =>
        request.headers.get("Authorization") === "Bearer refreshed-token"
          ? HttpResponse.json({ data: { itemId, page: 0 } })
          : new HttpResponse(null, { status: 401 }),
      ),
    )

    await expect(
      apiRequest(TestRoutes.getItem, { params: { itemId }, query: { page: 0 } }),
    ).resolves.toEqual({ itemId, page: 0 })
  })

  it("ends the session and signs in again, back to this page, when the API refuses the refreshed token", async () => {
    server.use(
      http.get(
        "http://desk.test/api/test/items/:itemId",
        () => new HttpResponse(null, { status: 401 }),
      ),
    )

    await expect(
      apiRequest(TestRoutes.getItem, { params: { itemId }, query: { page: 0 } }),
    ).rejects.toBeInstanceOf(session.AuthenticationRequiredError)
    expect(session.endSession).toHaveBeenCalled()
    expect(session.signIn).toHaveBeenCalledWith({ returnTo: "/app/o/1?tab=a" })
  })

  it("explains a sign-in the API refuses, without a new sign-in that would fail the same", async () => {
    server.use(
      http.get("http://desk.test/api/test/items/:itemId", () =>
        HttpResponse.json(
          {
            statusCode: 401,
            message: "The identity provider did not return an email for this user",
          },
          { status: 401 },
        ),
      ),
    )

    const request = apiRequest(TestRoutes.getItem, { params: { itemId }, query: { page: 0 } })
    await expect(request).rejects.toBeInstanceOf(session.SignInRefusedError)
    await expect(request).rejects.toHaveProperty("refusal", "emailRequired")
    expect(session.signIn).not.toHaveBeenCalled()
  })

  it("signs in again when the API's message only names a key every object inherits", async () => {
    server.use(
      http.get("http://desk.test/api/test/items/:itemId", () =>
        HttpResponse.json({ statusCode: 401, message: "constructor" }, { status: 401 }),
      ),
    )

    await expect(
      apiRequest(TestRoutes.getItem, { params: { itemId }, query: { page: 0 } }),
    ).rejects.toBeInstanceOf(session.AuthenticationRequiredError)
    expect(session.signIn).toHaveBeenCalled()
  })

  it("stops when a new sign-in started a moment ago, rather than loop", async () => {
    session.claimAutomaticSignIn.mockReturnValueOnce(false)
    server.use(
      http.get(
        "http://desk.test/api/test/items/:itemId",
        () => new HttpResponse(null, { status: 401 }),
      ),
    )

    await expect(
      apiRequest(TestRoutes.getItem, { params: { itemId }, query: { page: 0 } }),
    ).rejects.toBeInstanceOf(session.SignInLoopError)
    expect(session.signIn).not.toHaveBeenCalled()
  })
})
