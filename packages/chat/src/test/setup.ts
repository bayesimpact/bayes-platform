import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest"
import { server } from "./server"

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" })
  // MSW keeps a clone of each mocked response for its events, a tee of the body that nobody
  // reads. A reader that stops a stream before its end then waits for ever on `cancel()`, which a
  // real connection does not. Cancelling the clone's branch lets the reader's own cancel settle.
  server.events.on("response:mocked", ({ response }) => {
    void response.body?.cancel()
  })
})
beforeEach(() => {
  // Each spec starts from a world of its own, and a blank storage.
  server.resetHandlers()
  window.localStorage.clear()
  window.sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  // A spy on `console.error` in one spec must not silence the next one.
  vi.restoreAllMocks()
})
afterAll(() => server.close())
