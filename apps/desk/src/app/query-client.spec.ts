import { describe, expect, it, vi } from "vitest"

// The configuration needs a browser to load: a stand-in lets the app's session load in node.
vi.mock("@/app/config", () => ({
  appBasePath: "/app/",
  appConfig: { mode: "mock" },
  isMockMode: true,
}))

const { shouldRetryQuery } = await import("@/lib/api-client")
const { createQueryClient } = await import("./query-client")

describe("createQueryClient", () => {
  it("retries a query as the shared rule says, and never a mutation", () => {
    const options = createQueryClient().getDefaultOptions()
    expect(options.queries?.retry).toBe(shouldRetryQuery)
    expect(options.mutations?.retry).toBe(false)
  })

  it("retries no query in the tests and the stories", () => {
    expect(createQueryClient({ isRetrying: false }).getDefaultOptions().queries?.retry).toBe(false)
  })
})
