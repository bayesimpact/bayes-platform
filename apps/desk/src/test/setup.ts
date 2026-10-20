import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest"
import { activateLocale } from "@/app/i18n"
import { server } from "./msw/server"

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
beforeEach(async () => {
  await activateLocale("en")
})
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
