import "@testing-library/jest-dom/vitest"
import { i18n } from "@lingui/core"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach } from "vitest"

// The specs read the English source of each message: no catalog is loaded.
i18n.loadAndActivate({ locale: "en", messages: {} })

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
})
