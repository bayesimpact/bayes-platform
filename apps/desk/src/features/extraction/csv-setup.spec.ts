import { describe, expect, it } from "vitest"
import { initialColumnRoles, readsAColumn, sampleOf, toColumnSchema } from "./csv-setup"

const columns = [
  { id: "c1", name: "title", values: ["Alpha", "Beta"] },
  { id: "c2", name: "notes", values: [] },
]

describe("csv setup", () => {
  it("starts with every column read, and gives the API each column with its role", () => {
    const roles = { ...initialColumnRoles(columns), c2: "ignore" as const }
    expect(toColumnSchema(columns, roles)).toEqual({
      c1: { id: "c1", originalName: "title", finalName: "title", role: "input", index: 0 },
      c2: { id: "c2", originalName: "notes", finalName: "notes", role: "ignore", index: 1 },
    })
    expect(readsAColumn(roles)).toBe(true)
    expect(readsAColumn({ c1: "reference", c2: "ignore" })).toBe(false)
  })

  it("shows a column's first values on one line, without the empty ones", () => {
    expect(sampleOf(["Alpha", "", null, "Beta\n two", "Gamma", "Delta"])).toBe(
      "Alpha, Beta two, Gamma",
    )
  })
})
