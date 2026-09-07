import type { Bucket, File, GetFilesOptions } from "@google-cloud/storage"
import { Logger } from "@nestjs/common"
import { PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN } from "./pdf-exports.constants"
import { PdfExportsSweepService } from "./pdf-exports-sweep.service"

type FakeFile = {
  name: string
  metadata: { timeCreated?: string }
  delete: jest.Mock
}

describe("PdfExportsSweepService", () => {
  // TTL 15 min + 60 s grace: anything created before 11:44:00 is expired at noon.
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

  const buildFile = (name: string, timeCreated?: string): FakeFile => ({
    name,
    metadata: timeCreated === undefined ? {} : { timeCreated },
    delete: jest.fn().mockResolvedValue([{}]),
  })

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
    const expiredOnFirstPage = buildFile(
      "tmp/pdf-exports/aaa/report.pdf",
      "2026-05-04T11:00:00.000Z",
    )
    const freshOnFirstPage = buildFile("tmp/pdf-exports/bbb/report.pdf", "2026-05-04T11:55:00.000Z")
    const expiredOnSecondPage = buildFile(
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

  it("keeps files whose creation date is missing or unparseable", async () => {
    const withoutDate = buildFile("tmp/pdf-exports/aaa/report.pdf")
    const withBadDate = buildFile("tmp/pdf-exports/bbb/report.pdf", "not-a-date")
    const bucket = buildBucket([[withoutDate, withBadDate]])

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 2, deleted: 0, failed: 0, skipped: false })
    expect(withoutDate.delete).not.toHaveBeenCalled()
    expect(withBadDate.delete).not.toHaveBeenCalled()
  })

  it("counts a rejected delete as failed without failing the sweep", async () => {
    const undeletable = buildFile("tmp/pdf-exports/aaa/report.pdf", "2026-05-04T10:00:00.000Z")
    undeletable.delete.mockRejectedValue(new Error("permission denied"))
    const deletable = buildFile("tmp/pdf-exports/bbb/report.pdf", "2026-05-04T10:00:00.000Z")
    const bucket = buildBucket([[undeletable, deletable]])

    const result = await new PdfExportsSweepService(bucket).sweepExpiredExports(now)

    expect(result).toEqual({ scanned: 2, deleted: 1, failed: 1, skipped: false })
  })

  it("honours the configured TTL and prefix", async () => {
    process.env[prefixKey] = "scratch/exports/"
    process.env[ttlKey] = "60"
    // Older than 15 min but within the 60 min TTL, so still live.
    const withinLongerTtl = buildFile("scratch/exports/aaa/report.pdf", "2026-05-04T11:30:00.000Z")
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
        buildFile(`tmp/pdf-exports/page-${index}/report.pdf`, "2026-05-04T10:00:00.000Z"),
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
