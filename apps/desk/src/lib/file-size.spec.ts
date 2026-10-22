import { describe, expect, it } from "vitest"
import { fileSizeOf } from "./file-size"

describe("fileSizeOf", () => {
  it("writes a size with its unit, rounded to what reads well", () => {
    expect(fileSizeOf(820, "en")).toBe("0.8 kB")
    expect(fileSizeOf(2_400_000, "en")).toBe("2.4 MB")
    expect(fileSizeOf(24_000_000, "en")).toBe("24 MB")
  })
})
