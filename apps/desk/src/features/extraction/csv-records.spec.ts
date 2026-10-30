import { describe, expect, it } from "vitest"
import { fileValueOf } from "./csv-records"

describe("fileValueOf", () => {
  it("reads a row's value in a column of the file, as one line of text", () => {
    expect(fileValueOf({ title: "Annual report", year: 2024 }, "title")).toBe("Annual report")
    expect(fileValueOf({ title: "Annual report", year: 2024 }, "year")).toBe("2024")
    expect(fileValueOf(null, "title")).toBe("")
  })

  it("reads nothing for a column named like a key every object inherits", () => {
    expect(fileValueOf({ title: "Annual report" }, "constructor")).toBe("")
  })
})
