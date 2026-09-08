import type { Bucket, File, GetFilesOptions } from "@google-cloud/storage"
import { Logger } from "@nestjs/common"
import { PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN } from "./pdf-exports.constants"
import { PdfExportsSweepService } from "./pdf-exports-sweep.service"

type FakeFileMetadata = { customTime?: string; timeCreated?: string }

type FakeFile = {
  name: string
  metadata: FakeFileMetadata
  delete: jest.Mock
}

describe("PdfExportsSweepService", () => {
  // 60 s grace: an export whose customTime is before 11:59:00 is expired at noon.
  // Legacy objects without customTime: TTL 15 min + grace, created before 11:44:00.
  const now = new Date("2026-05-04T12:00:00.000Z")
  const prefixKey = "PDF_EXPORT_TMP_PREFIX"
  const ttlKey = "PDF_EXPORT_TTL_MINUTES"
  const originalPrefix = process.env[prefixKey]
  const originalTtl = process.env[ttlKey]

  beforeEach(() => {
    delete process.env[prefixKey]
    delete process.env[ttlKey]
    // The sweep reports its counts by design; keep them out of the test output.
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {})
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(() => {
    if (originalPrefix === undefined) {
      delete process.env[prefixKey]
    } else {
      process.env[prefixKey] = originalPrefix
    }
    if (originalTtl === undefined) {
      delete process.env[ttlKey]
    } else {
      process.env[ttlKey] = originalTtl
    }
  })

  const buildFile = (name: string, metadata: FakeFileMetadata = {}): FakeFile => ({
    name,
    metadata,
    delete: jest.fn().mockResolvedValue([{}]),
  })

  /** An export the converter stamped with its URL expiry, as every current export is. */
  const buildStampedFile = (name: string, customTime: string): FakeFile =>
    buildFile(name, { customTime, timeCreated: "2026-05-04T11:00:00.000Z" })

  /** An export written before the converter stamped expiries: only `timeCreated` is known. */
  const buildLegacyFile = (name: string, timeCreated?: string): FakeFile =>
    buildFile(name, timeCreated === undefined ? {} : { timeCreated })

  /** Serves `pages` in order, chaining them with a page token like GCS does. */
  const buildBucket = (pages: FakeFile[][]) => {
    const getFiles = jest.fn(async (query: GetFilesOptions) => {
      const pageIndex = query.pageToken === undefined ? 0 : Number(query.pageToken)
      const files = pages[pageIndex] ?? []
      const isLastPage = pageIndex >= pages.length - 1
      return [
        files as unknown as File[],
        isLastPage ? undefined : { pageToken: `${pageIndex + 1}` },
      ]
    })
    return { getFiles } as unknown as Bucket
  }

  it("deletes expired exports across every page and keeps fresh ones", async () => {
    const expiredOnFirstPage = buildStampedFile(
      "tmp/pdf-exports/aaa/report.pdf",
      "2026-05-04T11:58:59.000Z",
    )
    const freshOnFirstPage = buildStampedFile(
      "tmp/pdf-exports/bbb/report.pdf",
      "2026-05-04T11:59:00.000Z",
    )
    const expiredOnSecondPage = buildStampedFile(
      "tmp/pdf-exports/ccc/report.pdf",
      "2026-05-03T09:00:00.000Z",
    )
    const bucket = buildBucket([[expiredOnFirstPage, freshOnFirstPage], [expiredOnSecondPage]])

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 3, deleted: 2, failed: 0, skipped: false })
    expect(expiredOnFirstPage.delete).toHaveBeenCalledWith({ ignoreNotFound: true })
    expect(expiredOnSecondPage.delete).toHaveBeenCalledTimes(1)
    expect(freshOnFirstPage.delete).not.toHaveBeenCalled()
    expect(bucket.getFiles).toHaveBeenCalledTimes(2)
    expect(bucket.getFiles).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ prefix: "tmp/pdf-exports/", autoPaginate: false }),
    )
  })

  it("trusts the stamped expiry over the locally configured TTL", async () => {
    process.env[ttlKey] = "15"
    // Created 50 minutes ago, well past the local TTL, but the converter signed
    // its URL for an hour: it must survive.
    const stillDownloadable = buildFile("tmp/pdf-exports/aaa/report.pdf", {
      customTime: "2026-05-04T12:10:00.000Z",
      timeCreated: "2026-05-04T11:10:00.000Z",
    })
    // Created 5 minutes ago, within the local TTL, but its URL already expired
    // (the converter ran with a shorter TTL): it must go.
    const alreadyExpired = buildFile("tmp/pdf-exports/bbb/report.pdf", {
      customTime: "2026-05-04T11:57:00.000Z",
      timeCreated: "2026-05-04T11:55:00.000Z",
    })
    const bucket = buildBucket([[stillDownloadable, alreadyExpired]])

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 2, deleted: 1, failed: 0, skipped: false })
    expect(stillDownloadable.delete).not.toHaveBeenCalled()
    expect(alreadyExpired.delete).toHaveBeenCalledTimes(1)
  })

  it("falls back to creation date plus TTL for legacy objects without a stamped expiry", async () => {
    const expiredLegacy = buildLegacyFile(
      "tmp/pdf-exports/aaa/report.pdf",
      "2026-05-04T11:43:59.000Z",
    )
    const freshLegacy = buildLegacyFile(
      "tmp/pdf-exports/bbb/report.pdf",
      "2026-05-04T11:44:00.000Z",
    )
    const bucket = buildBucket([[expiredLegacy, freshLegacy]])

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 2, deleted: 1, failed: 0, skipped: false })
    expect(expiredLegacy.delete).toHaveBeenCalledTimes(1)
    expect(freshLegacy.delete).not.toHaveBeenCalled()
  })

  it("keeps files whose expiry and creation date are both missing or unparseable", async () => {
    const withoutDate = buildLegacyFile("tmp/pdf-exports/aaa/report.pdf")
    const withBadDate = buildLegacyFile("tmp/pdf-exports/bbb/report.pdf", "not-a-date")
    const withBadExpiryAndNoDate = buildFile("tmp/pdf-exports/ccc/report.pdf", {
      customTime: "not-a-date",
    })
    const bucket = buildBucket([[withoutDate, withBadDate, withBadExpiryAndNoDate]])

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 3, deleted: 0, failed: 0, skipped: false })
    expect(withoutDate.delete).not.toHaveBeenCalled()
    expect(withBadDate.delete).not.toHaveBeenCalled()
    expect(withBadExpiryAndNoDate.delete).not.toHaveBeenCalled()
  })

  it("counts a rejected delete as failed without failing the sweep", async () => {
    const undeletable = buildStampedFile(
      "tmp/pdf-exports/aaa/report.pdf",
      "2026-05-04T10:00:00.000Z",
    )
    undeletable.delete.mockRejectedValue(new Error("permission denied"))
    const deletable = buildStampedFile("tmp/pdf-exports/bbb/report.pdf", "2026-05-04T10:00:00.000Z")
    const bucket = buildBucket([[undeletable, deletable]])

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 2, deleted: 1, failed: 1, skipped: false })
  })

  it("honours the configured prefix and the legacy TTL for unstamped objects", async () => {
    process.env[prefixKey] = "scratch/exports/"
    process.env[ttlKey] = "60"
    // Older than 15 min but within the 60 min legacy TTL, so still live.
    const withinLongerTtl = buildLegacyFile(
      "scratch/exports/aaa/report.pdf",
      "2026-05-04T11:30:00.000Z",
    )
    const bucket = buildBucket([[withinLongerTtl]])

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 1, deleted: 0, failed: 0, skipped: false })
    expect(bucket.getFiles).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "scratch/exports/" }),
    )
  })

  it("skips the sweep when no bucket is configured", async () => {
    const result = await new PdfExportsSweepService(null).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 0, deleted: 0, failed: 0, skipped: true })
  })

  it("stops after the per-run page limit", async () => {
    const pages = Array.from(
      { length: PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN + 5 },
      (_page, index) => [
        buildStampedFile(`tmp/pdf-exports/page-${index}/report.pdf`, "2026-05-04T10:00:00.000Z"),
      ],
    )
    const bucket = buildBucket(pages)

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(bucket.getFiles).toHaveBeenCalledTimes(PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN)
    expect(result).toEqual({
      scanned: PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN,
      deleted: PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN,
      failed: 0,
      skipped: false,
    })
  })
})
