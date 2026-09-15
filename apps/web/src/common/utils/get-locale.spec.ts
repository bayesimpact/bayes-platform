import { enUS, fr } from "date-fns/locale"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getLocale, getSpeechRecognitionLanguage, toAgentLocale } from "./get-locale"

describe("toAgentLocale", () => {
  it.each(["fr", "fr-FR", "fr-CA", "FR"])("maps %s to fr", (language) => {
    expect(toAgentLocale(language)).toBe("fr")
  })

  it.each([
    "en",
    "en-US",
    "en-GB",
    "de",
    "",
    null,
    undefined,
  ])("falls back to en for %s", (language) => {
    expect(toAgentLocale(language)).toBe("en")
  })
})

describe("getSpeechRecognitionLanguage", () => {
  it("returns a full BCP 47 tag for French", () => {
    expect(getSpeechRecognitionLanguage("fr")).toBe("fr-FR")
    expect(getSpeechRecognitionLanguage("fr-FR")).toBe("fr-FR")
  })

  it("defaults to en-US", () => {
    expect(getSpeechRecognitionLanguage("en")).toBe("en-US")
    expect(getSpeechRecognitionLanguage(undefined)).toBe("en-US")
  })
})

// Tests run in Node, so the browser storage i18next writes to is stubbed.
describe("getLocale", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("returns the French date-fns locale when i18next stored a regional French tag", () => {
    vi.stubGlobal("localStorage", { getItem: () => "fr-FR" })
    expect(getLocale()).toBe(fr)
  })

  it("returns the English locale when nothing is stored", () => {
    vi.stubGlobal("localStorage", { getItem: () => null })
    expect(getLocale()).toBe(enUS)
  })
})
