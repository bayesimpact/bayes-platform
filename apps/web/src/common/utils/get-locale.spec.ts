import { de, enUS, es, fr, it as itLocale, pl } from "date-fns/locale"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getLocale, getSpeechRecognitionLanguage, toAgentLocale, toUiLanguage } from "./get-locale"

describe("toUiLanguage", () => {
  it.each([
    ["fr-FR", "fr"],
    ["DE", "de"],
    ["it-IT", "it"],
    ["es-MX", "es"],
    ["pl", "pl"],
    ["en-GB", "en"],
  ])("maps %s to %s", (language, expected) => {
    expect(toUiLanguage(language)).toBe(expected)
  })

  it.each(["pt", "", null, undefined])("falls back to en for %s", (language) => {
    expect(toUiLanguage(language)).toBe("en")
  })
})

describe("toAgentLocale", () => {
  it.each(["fr", "fr-FR", "fr-CA", "FR"])("maps %s to fr", (language) => {
    expect(toAgentLocale(language)).toBe("fr")
  })

  it.each([
    "en",
    "en-US",
    "en-GB",
    "de",
    "pl",
    "",
    null,
    undefined,
  ])("falls back to en for %s", (language) => {
    expect(toAgentLocale(language)).toBe("en")
  })
})

describe("getSpeechRecognitionLanguage", () => {
  it.each([
    ["fr", "fr-FR"],
    ["fr-FR", "fr-FR"],
    ["de", "de-DE"],
    ["it", "it-IT"],
    ["es", "es-ES"],
    ["pl", "pl-PL"],
  ])("returns a full BCP 47 tag for %s", (language, expected) => {
    expect(getSpeechRecognitionLanguage(language)).toBe(expected)
  })

  it("defaults to en-US", () => {
    expect(getSpeechRecognitionLanguage("en")).toBe("en-US")
    expect(getSpeechRecognitionLanguage(undefined)).toBe("en-US")
  })
})

// Tests run in Node, so the browser storage i18next writes to is stubbed.
describe("getLocale", () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ["fr-FR", fr],
    ["de-DE", de],
    ["it", itLocale],
    ["es", es],
    ["pl", pl],
  ])("returns the date-fns locale for a stored %s tag", (stored, expected) => {
    vi.stubGlobal("localStorage", { getItem: () => stored })
    expect(getLocale()).toBe(expected)
  })

  it("returns the English locale when nothing is stored", () => {
    vi.stubGlobal("localStorage", { getItem: () => null })
    expect(getLocale()).toBe(enUS)
  })
})
