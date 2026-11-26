import { describe, expect, it } from "vitest"
import { fileSizeOf } from "./file-size"

describe("fileSizeOf", () => {
  it("writes a size with its unit, rounded to what reads well", () => {
    expect(fileSizeOf(820, "en")).toBe("0.8 kB")
    expect(fileSizeOf(2.4 * 1024 * 1024, "en")).toBe("2.4 MB")
    expect(fileSizeOf(24 * 1024 * 1024, "en")).toBe("24 MB")
  })

  it("reads a limit set in binary units as it is set", () => {
    expect(fileSizeOf(10 * 1024 * 1024, "en")).toBe("10 MB")
    expect(fileSizeOf(25 * 1024 * 1024, "en")).toBe("25 MB")
  })
})
