import { AgentLocale } from "@caseai-connect/api-contracts"
import { resolveSupportedLocale } from "./accept-language"

describe("resolveSupportedLocale", () => {
  it("reads a plain language tag", () => {
    expect(resolveSupportedLocale("fr")).toBe(AgentLocale.FR)
  })

  it("drops the region subtag", () => {
    expect(resolveSupportedLocale("fr-CA")).toBe(AgentLocale.FR)
  })

  it("prefers the highest quality supported language", () => {
    expect(resolveSupportedLocale("de,en;q=0.5,fr;q=0.9")).toBe(AgentLocale.FR)
  })

  it("keeps header order between equal qualities", () => {
    expect(resolveSupportedLocale("en,fr")).toBe(AgentLocale.EN)
  })

  it("ignores a language the caller declared unacceptable", () => {
    expect(resolveSupportedLocale("fr;q=0,en")).toBe(AgentLocale.EN)
  })

  it("returns nothing when no supported language is offered", () => {
    expect(resolveSupportedLocale("de-DE,es;q=0.8,*;q=0.1")).toBeUndefined()
  })

  it("returns nothing when the header is missing or not a string", () => {
    expect(resolveSupportedLocale(undefined)).toBeUndefined()
    expect(resolveSupportedLocale(["fr"])).toBeUndefined()
  })
})
