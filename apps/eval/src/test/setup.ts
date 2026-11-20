import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest"
import { activateLocale } from "@/app/i18n"
import { appUpdate } from "@/lib/app-update"
import { evalHandlers } from "./msw/handlers"
import { server } from "./msw/server"

// Every test runs signed in, with no identity provider. A spec that watches the sign-in mocks
// this module again, with spies of its own.
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session")>()),
  hasSession: async () => true,
  getAccessToken: async () => "test-token",
}))

/**
 * The timers the code under test arms, so those still waiting when a file ends are cleared. The
 * router arms one before it shows a page as pending: left alone, it fires once the file's
 * window is gone, React then reads `window`, and Vitest fails the whole run on that error
 * although every test passed.
 */
const armedTimers = new Set<ReturnType<typeof setTimeout>>()
const armTimer = globalThis.setTimeout
// Safe: the wrapper passes its arguments to the real `setTimeout` and returns what it returns.
globalThis.setTimeout = Object.assign((...args: Parameters<typeof setTimeout>) => {
  const timer = armTimer(...args)
  armedTimers.add(timer)
  return timer
}, armTimer) as typeof setTimeout

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
beforeEach(async () => {
  // Each test starts from a world of its own, which no other test changed, and a blank storage.
  server.resetHandlers(...evalHandlers())
  window.localStorage.clear()
  window.sessionStorage.clear()
  appUpdate.reset()
  await activateLocale("en")
})
afterEach(() => {
  cleanup()
})
afterAll(() => {
  server.close()
  for (const timer of armedTimers) clearTimeout(timer)
  armedTimers.clear()
})
