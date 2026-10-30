import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest"
import { activateLocale } from "@/app/i18n"
import { deskHandlers } from "./msw/handlers"
import { server } from "./msw/server"

// Every test runs signed in, with no identity provider. A spec that watches the sign-in mocks
// this module again, with spies of its own.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  hasSession: async () => true,
  getAccessToken: async () => "test-token",
}))

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
beforeEach(async () => {
  // Each test starts from a world of its own, which no other test changed, and a blank storage.
  server.resetHandlers(...deskHandlers())
  window.localStorage.clear()
  window.sessionStorage.clear()
  await activateLocale("en")
})
afterEach(() => {
  cleanup()
})
afterAll(() => server.close())
