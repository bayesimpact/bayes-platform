import { QueryClient } from "@tanstack/react-query"
import { HttpResponse, http } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/app/config", () => ({ appBasePath: "/app/", appConfig: { buildId: "build-1" } }))
const appUpdate = vi.hoisted(() => ({ reportPublishedBuild: vi.fn() }))
vi.mock("@/lib/app-update", () => ({ appUpdate }))

const { publishedBuildQueryOptions } = await import("./queries")

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: "http://desk.test" } })
  appUpdate.reportPublishedBuild.mockReset()
})
afterEach(() => {
  server.resetHandlers()
  vi.unstubAllGlobals()
})
afterAll(() => server.close())

const fetchPublishedBuild = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } }).fetchQuery(
    publishedBuildQueryOptions(),
  )

describe("publishedBuildQueryOptions", () => {
  it("reads the build in the Desk's version.json, past the browser's cache, and reports it", async () => {
    let cacheControl: string | null = null
    server.use(
      http.get("http://desk.test/app/version.json", ({ request }) => {
        cacheControl = request.headers.get("Cache-Control")
        return HttpResponse.json({ buildId: "build-2" })
      }),
    )

    expect(await fetchPublishedBuild()).toBe("build-2")
    expect(appUpdate.reportPublishedBuild).toHaveBeenCalledWith("build-2")
    expect(cacheControl).toBe("no-cache")
  })

  it("reports nothing when the file is missing or says no build", async () => {
    server.use(
      http.get("http://desk.test/app/version.json", () => new HttpResponse(null, { status: 404 }), {
        once: true,
      }),
      http.get("http://desk.test/app/version.json", () => HttpResponse.json({ buildId: "" })),
    )

    await expect(fetchPublishedBuild()).rejects.toThrow("version.json answered 404")
    await expect(fetchPublishedBuild()).rejects.toThrow()
    expect(appUpdate.reportPublishedBuild).not.toHaveBeenCalled()
  })

  it("polls every minute", () => {
    expect(publishedBuildQueryOptions().refetchInterval).toBe(60 * 1000)
  })
})
