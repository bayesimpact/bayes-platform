import {
  getPdfExportSweepIntervalSeconds,
  getPdfExportTmpPrefix,
  getPdfExportTtlMinutes,
} from "./pdf-exports.config"

describe("pdf-exports.config", () => {
  const intervalKey = "PDF_EXPORT_SWEEP_INTERVAL_SECONDS"
  const ttlKey = "PDF_EXPORT_TTL_MINUTES"
  const prefixKey = "PDF_EXPORT_TMP_PREFIX"
  const originalValues = {
    [intervalKey]: process.env[intervalKey],
    [ttlKey]: process.env[ttlKey],
    [prefixKey]: process.env[prefixKey],
  }

  const restore = (): void => {
    for (const [key, originalValue] of Object.entries(originalValues)) {
      if (originalValue === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalValue
      }
    }
  }

  beforeEach(() => {
    delete process.env[intervalKey]
    delete process.env[ttlKey]
    delete process.env[prefixKey]
  })

  afterAll(restore)

  it("defaults the sweep interval to 300 seconds", () => {
    expect(getPdfExportSweepIntervalSeconds()).toBe(300)
  })

  it("reads the sweep interval override", () => {
    process.env[intervalKey] = "60"
    expect(getPdfExportSweepIntervalSeconds()).toBe(60)
  })

  it("throws when the sweep interval is not a positive integer", () => {
    process.env[intervalKey] = "0"
    expect(() => getPdfExportSweepIntervalSeconds()).toThrow(
      /PDF_EXPORT_SWEEP_INTERVAL_SECONDS must be a positive integer/,
    )
  })

  it("defaults the TTL to 15 minutes", () => {
    expect(getPdfExportTtlMinutes()).toBe(15)
  })

  it("reads the TTL override", () => {
    process.env[ttlKey] = "30"
    expect(getPdfExportTtlMinutes()).toBe(30)
  })

  it.each([
    ["text", "not-a-number"],
    ["a trailing unit the converter rejects", "15m"],
    ["a decimal the converter rejects", "1.5"],
    ["zero", "0"],
  ])("throws when the TTL is %s", (_description, rawValue) => {
    process.env[ttlKey] = rawValue
    expect(() => getPdfExportTtlMinutes()).toThrow(
      /PDF_EXPORT_TTL_MINUTES must be a positive integer/,
    )
  })

  it("falls back to the default TTL when the variable is empty", () => {
    process.env[ttlKey] = ""
    expect(getPdfExportTtlMinutes()).toBe(15)
  })

  it("reads the TTL at the seven-day cap", () => {
    process.env[ttlKey] = "10080"
    expect(getPdfExportTtlMinutes()).toBe(10080)
  })

  it("throws when the TTL is above the seven-day signing limit", () => {
    process.env[ttlKey] = "10081"
    expect(() => getPdfExportTtlMinutes()).toThrow(/PDF_EXPORT_TTL_MINUTES must be at most 10080/)
  })

  it("defaults the tmp prefix", () => {
    expect(getPdfExportTmpPrefix()).toBe("tmp/pdf-exports/")
  })

  it("reads the tmp prefix override", () => {
    process.env[prefixKey] = "scratch/exports/"
    expect(getPdfExportTmpPrefix()).toBe("scratch/exports/")
  })

  it("falls back to the default tmp prefix when the variable is empty, like the converter", () => {
    process.env[prefixKey] = ""
    expect(getPdfExportTmpPrefix()).toBe("tmp/pdf-exports/")
  })

  it.each([
    ["the bucket root", "/"],
    ["absolute", "/tmp/pdf-exports/"],
    ["traversing", "tmp/../"],
    ["not a folder", "tmp/pdf-exports"],
  ])("rejects a prefix that is %s", (_description, prefix) => {
    process.env[prefixKey] = prefix
    expect(() => getPdfExportTmpPrefix()).toThrow(/PDF_EXPORT_TMP_PREFIX/)
  })
})
