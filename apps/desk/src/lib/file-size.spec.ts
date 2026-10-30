import { ATTACHMENT_MAX_BYTES, EXTRACTION_MAX_BYTES } from "@caseai-connect/desk-contracts"
import { describe, expect, it } from "vitest"
import { fileSizeOf } from "./file-size"

describe("fileSizeOf", () => {
  it("writes a size with its unit, rounded to what reads well", () => {
    expect(fileSizeOf(820, "en")).toBe("0.8 kB")
    expect(fileSizeOf(2.4 * 1024 * 1024, "en")).toBe("2.4 MB")
    expect(fileSizeOf(24 * 1024 * 1024, "en")).toBe("24 MB")
  })

  it("writes the contracts' limits as they are set", () => {
    expect(fileSizeOf(EXTRACTION_MAX_BYTES, "en")).toBe("25 MB")
    expect(fileSizeOf(ATTACHMENT_MAX_BYTES, "en")).toBe("10 MB")
  })
})
