import { describe, expect, it } from "vitest"
import { extractionMimeTypeOf, fileKindOf, fileProblemOf } from "./extraction-files"

const fileOf = (name: string, type: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type })

describe("extractionMimeTypeOf", () => {
  it("takes the browser's type, or the extension's when the browser names none", () => {
    expect(extractionMimeTypeOf({ name: "report.pdf", type: "application/pdf" })).toBe(
      "application/pdf",
    )
    expect(extractionMimeTypeOf({ name: "notes.md", type: "" })).toBe("text/markdown")
  })

  it("reads a CSV file as one, whatever Windows calls it", () => {
    expect(extractionMimeTypeOf({ name: "rows.csv", type: "application/vnd.ms-excel" })).toBe(
      "text/csv",
    )
  })

  it("refuses a file whose extension names a key every object inherits", () => {
    expect(extractionMimeTypeOf({ name: "notes.constructor", type: "" })).toBe(null)
    expect(extractionMimeTypeOf({ name: "notes.__proto__", type: "" })).toBe(null)
  })

  it("refuses a file an extraction cannot read", () => {
    expect(
      extractionMimeTypeOf({ name: "slides.pptx", type: "application/vnd.ms-powerpoint" }),
    ).toBe(null)
  })
})

describe("fileProblemOf", () => {
  it("names why a file cannot be read", () => {
    expect(fileProblemOf(fileOf("report.pdf", "application/pdf"))).toBe(null)
    expect(fileProblemOf(fileOf("movie.mp4", "video/mp4"))).toBe("type")
    expect(fileProblemOf(fileOf("empty.txt", "text/plain", 0))).toBe("empty")
    expect(fileProblemOf(fileOf("huge.pdf", "application/pdf", 26 * 1024 * 1024))).toBe("size")
  })
})

describe("fileKindOf", () => {
  it("reads a document named with an inherited key as another kind of file", () => {
    expect(fileKindOf({ fileName: "notes.constructor" })).toBe("other")
    expect(fileKindOf({ fileName: "notes.__proto__" })).toBe("other")
  })

  it("groups the files by how they show and run", () => {
    expect(fileKindOf({ mimeType: "image/jpeg" })).toBe("image")
    expect(fileKindOf({ mimeType: "text/csv" })).toBe("csv")
    expect(fileKindOf({ fileName: "notes.md" })).toBe("text")
    expect(fileKindOf({})).toBe("other")
  })
})
