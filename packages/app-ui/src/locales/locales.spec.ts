import { describe, expect, it } from "vitest"
import { LOCALES } from "./index"

describe("LOCALES", () => {
  it("names every catalog of the folder, and only those", () => {
    const catalogNames = Object.keys(import.meta.glob("./*.po")).map((path) =>
      path.replace(/^\.\//, "").replace(/\.po$/, ""),
    )
    expect([...LOCALES].sort()).toEqual(catalogNames.sort())
  })
})
