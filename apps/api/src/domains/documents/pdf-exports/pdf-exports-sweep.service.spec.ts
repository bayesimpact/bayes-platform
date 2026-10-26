import { Logger } from "@nestjs/common"
import { PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN } from "./pdf-exports.constants"
import type { PdfExportsBucket, PdfExportsObject } from "./pdf-exports-bucket"
import { PdfExportsSweepService, parseExpiryFromName } from "./pdf-exports-sweep.service"

describe("PdfExportsSweepService", () => {
  // 60 s grace: an export whose expiry is before 11:59:00 is expired at noon.
  // Legacy objects without an expiry in their name: TTL 15 min + grace, created before 11:44:00.
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

  const unixSeconds = (isoDate: string) => Math.floor(new Date(isoDate).getTime() / 1000)

  /** An export named with its URL expiry, as the converter writes every current export. */
  const buildExport = (id: string, expiresAt: string, prefix = "tmp/pdf-exports/") => ({
    name: `${prefix}${unixSeconds(expiresAt)}-${id}/report.pdf`,
    createdAt: new Date("2026-05-04T11:00:00.000Z"),
  })

  /** An export written before the expiry was in the name: only its creation date is known. */
  const buildLegacyExport = (
    id: string,
    createdAt?: string,
    prefix = "tmp/pdf-exports/",
  ): PdfExportsObject => ({
    name: `${prefix}${id}/report.pdf`,
    createdAt: createdAt === undefined ? undefined : new Date(createdAt),
  })

  /** Serves `pages` in order, chaining them with a page token. */
  const buildBucket = (pages: PdfExportsObject[][]) => {
    const listPage = jest.fn(async ({ pageToken }: { pageToken?: string }) => {
      const pageIndex = pageToken === undefined ? 0 : Number(pageToken)
      const isLastPage = pageIndex >= pages.length - 1
      return {
        objects: pages[pageIndex] ?? [],
        nextPageToken: isLastPage ? undefined : `${pageIndex + 1}`,
      }
    })
    const deleteObject = jest.fn(async (_name: string) => {})
    const bucket: PdfExportsBucket = { listPage, delete: deleteObject }
    return { bucket, listPage, deleteObject }
  }

  it("deletes expired exports across every page and keeps fresh ones", async () => {
    const expiredOnFirstPage = buildExport("aaa", "2026-05-04T11:58:59.000Z")
    const freshOnFirstPage = buildExport("bbb", "2026-05-04T11:59:00.000Z")
    const expiredOnSecondPage = buildExport("ccc", "2026-05-03T09:00:00.000Z")
    const { bucket, listPage, deleteObject } = buildBucket([
      [expiredOnFirstPage, freshOnFirstPage],
      [expiredOnSecondPage],
    ])

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 3, deleted: 2, failed: 0, skipped: false })
    expect(deleteObject.mock.calls.map(([name]) => name)).toEqual([
      expiredOnFirstPage.name,
      expiredOnSecondPage.name,
    ])
    expect(listPage).toHaveBeenCalledTimes(2)
    expect(listPage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ prefix: "tmp/pdf-exports/" }),
    )
  })

  it("trusts the expiry in the name over the locally configured TTL", async () => {
    process.env[ttlKey] = "15"
    // Created 50 minutes ago, well past the local TTL, but the converter signed
    // its URL for an hour: it must survive.
    const stillDownloadable = {
      ...buildExport("aaa", "2026-05-04T12:10:00.000Z"),
      createdAt: new Date("2026-05-04T11:10:00.000Z"),
    }
    // Created 5 minutes ago, within the local TTL, but its URL already expired
    // (the converter ran with a shorter TTL): it must go.
    const alreadyExpired = {
      ...buildExport("bbb", "2026-05-04T11:57:00.000Z"),
      createdAt: new Date("2026-05-04T11:55:00.000Z"),
    }
    const { bucket, deleteObject } = buildBucket([[stillDownloadable, alreadyExpired]])

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 2, deleted: 1, failed: 0, skipped: false })
    expect(deleteObject).toHaveBeenCalledWith(alreadyExpired.name)
    expect(deleteObject).not.toHaveBeenCalledWith(stillDownloadable.name)
  })

  it("falls back to creation date plus TTL for legacy names without an expiry", async () => {
    const expiredLegacy = buildLegacyExport("aaa", "2026-05-04T11:43:59.000Z")
    const freshLegacy = buildLegacyExport("bbb", "2026-05-04T11:44:00.000Z")
    const { bucket, deleteObject } = buildBucket([[expiredLegacy, freshLegacy]])

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 2, deleted: 1, failed: 0, skipped: false })
    expect(deleteObject.mock.calls.map(([name]) => name)).toEqual([expiredLegacy.name])
  })

  it("keeps legacy objects whose creation date is unknown", async () => {
    const withoutDate = buildLegacyExport("aaa")
    const { bucket, deleteObject } = buildBucket([[withoutDate]])

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 1, deleted: 0, failed: 0, skipped: false })
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it("counts a rejected delete as failed without failing the sweep", async () => {
    const undeletable = buildExport("aaa", "2026-05-04T10:00:00.000Z")
    const deletable = buildExport("bbb", "2026-05-04T10:00:00.000Z")
    const { bucket, deleteObject } = buildBucket([[undeletable, deletable]])
    deleteObject.mockImplementation(async (name: string) => {
      if (name === undeletable.name) throw new Error("permission denied")
    })

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 2, deleted: 1, failed: 1, skipped: false })
  })

  it("honours the configured prefix and the legacy TTL for legacy names", async () => {
    process.env[prefixKey] = "scratch/exports/"
    process.env[ttlKey] = "60"
    // Older than 15 min but within the 60 min legacy TTL, so still live.
    const withinLongerTtl = buildLegacyExport("aaa", "2026-05-04T11:30:00.000Z", "scratch/exports/")
    const { bucket, listPage } = buildBucket([[withinLongerTtl]])

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 1, deleted: 0, failed: 0, skipped: false })
    expect(listPage).toHaveBeenCalledWith(expect.objectContaining({ prefix: "scratch/exports/" }))
  })

  it("skips the sweep when no bucket is configured", async () => {
    const result = await new PdfExportsSweepService(null).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 0, deleted: 0, failed: 0, skipped: true })
  })

  it("stops after the per-run page limit", async () => {
    const pages = Array.from(
      { length: PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN + 5 },
      (_page, index) => [buildExport(`page-${index}`, "2026-05-04T10:00:00.000Z")],
    )
    const { bucket, listPage } = buildBucket(pages)

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(listPage).toHaveBeenCalledTimes(PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN)
    expect(result).toEqual({
      scanned: PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN,
      deleted: PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN,
      failed: 0,
      skipped: false,
    })
  })
})

describe("parseExpiryFromName", () => {
  it("reads the Unix seconds before the id", () => {
    expect(
      parseExpiryFromName("tmp/pdf-exports/1788783300-abc/Rapport final.pdf", "tmp/pdf-exports/"),
    ).toEqual(new Date("2026-09-07T12:15:00.000Z"))
  })

  it("returns undefined for a legacy name, a name outside the prefix or a bare file", () => {
    expect(
      parseExpiryFromName("tmp/pdf-exports/abc/report.pdf", "tmp/pdf-exports/"),
    ).toBeUndefined()
    expect(
      parseExpiryFromName("other/1788783300-abc/report.pdf", "tmp/pdf-exports/"),
    ).toBeUndefined()
    expect(
      parseExpiryFromName("tmp/pdf-exports/1788783300-abc", "tmp/pdf-exports/"),
    ).toBeUndefined()
  })
})
