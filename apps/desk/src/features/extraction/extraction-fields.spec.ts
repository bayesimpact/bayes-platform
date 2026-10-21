import { describe, expect, it } from "vitest"
import {
  extractedFieldsOf,
  fieldKeysOf,
  fieldLabelOf,
  isEmptyValue,
  plainTextOf,
  resultFileNameOf,
} from "./extraction-fields"

describe("fieldLabelOf", () => {
  it("writes a key as words, whatever its case", () => {
    expect(fieldLabelOf("numberOfParagraphs")).toBe("Number of paragraphs")
    expect(fieldLabelOf("number_of_paragraphs")).toBe("Number of paragraphs")
    expect(fieldLabelOf("summary")).toBe("Summary")
  })

  it("keeps an acronym in capitals", () => {
    expect(fieldLabelOf("PDFUrl")).toBe("PDF url")
  })
})

describe("extractedFieldsOf", () => {
  it("keeps the agent's order", () => {
    expect(
      extractedFieldsOf({ title: "Report", pageCount: 3 }).map((field) => field.label),
    ).toEqual(["Title", "Page count"])
  })
})

describe("fieldKeysOf", () => {
  it("lists the keys of every result once, in the order they first appear", () => {
    expect(fieldKeysOf([{ title: "A" }, null, { title: "B", topic: "C" }])).toEqual([
      "title",
      "topic",
    ])
  })
})

describe("isEmptyValue and plainTextOf", () => {
  it("tells an empty value from one the agent found", () => {
    expect([null, undefined, "  ", []].every(isEmptyValue)).toBe(true)
    expect([0, false, "a"].some(isEmptyValue)).toBe(false)
  })

  it("writes a list of words on one line, and an object as JSON", () => {
    expect(plainTextOf(["Product", "Pricing"])).toBe("Product, Pricing")
    expect(plainTextOf({ a: 1 })).toBe('{\n  "a": 1\n}')
  })
})

describe("resultFileNameOf", () => {
  it("names the JSON file after the document", () => {
    expect(resultFileNameOf("report.pdf")).toBe("report.json")
    expect(resultFileNameOf(null)).toBe("extraction.json")
  })
})
