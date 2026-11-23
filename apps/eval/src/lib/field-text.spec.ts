import { setupI18n } from "@lingui/core"
import { describe, expect, it } from "vitest"
import { fieldLabelOf, fieldTextOf } from "./field-text"

const english = setupI18n({ locale: "en", messages: { en: {} } })

describe("fieldLabelOf", () => {
  it("writes a key as words, whatever its case", () => {
    expect(fieldLabelOf("numberOfParagraphs")).toBe("Number of paragraphs")
    expect(fieldLabelOf("number_of_paragraphs")).toBe("Number of paragraphs")
    expect(fieldLabelOf("number-of-paragraphs")).toBe("Number of paragraphs")
    expect(fieldLabelOf("summary")).toBe("Summary")
  })

  it("keeps an acronym in capitals", () => {
    expect(fieldLabelOf("PDFUrl")).toBe("PDF url")
  })
})

describe("fieldTextOf", () => {
  it("writes yes or no as words, and a number with the person's separators", () => {
    const french = setupI18n({ locale: "fr", messages: { fr: {} } })

    expect(fieldTextOf(true, english)).toBe("Yes")
    expect(fieldTextOf(false, english)).toBe("No")
    expect(fieldTextOf(1200, french).replace(/\s/g, " ")).toBe("1 200")
  })

  it("writes a list of words on one line, an object as JSON, and no value as nothing", () => {
    expect(fieldTextOf(["Product", "Pricing"], english)).toBe("Product, Pricing")
    expect(fieldTextOf({ a: 1 }, english)).toBe('{\n  "a": 1\n}')
    expect(fieldTextOf(null, english)).toBe("")
  })
})
