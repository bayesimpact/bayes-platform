import type { Bucket, File } from "@google-cloud/storage"
import { Inject, Injectable, Logger } from "@nestjs/common"
import { getPdfExportTmpPrefix, getPdfExportTtlMinutes } from "./pdf-exports.config"
import {
  PDF_EXPORTS_BUCKET,
  PDF_EXPORTS_DELETE_CHUNK_SIZE,
  PDF_EXPORTS_DELETE_GRACE_SECONDS,
  PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN,
  PDF_EXPORTS_SWEEP_PAGE_SIZE,
} from "./pdf-exports.constants"

export type PdfExportsSweepResult = {
  scanned: number
  deleted: number
  failed: number
  skipped: boolean
}

/**
 * Deletes temporary PDF exports written by `apps/pdf-converter` once their
 * signed download URLs have expired. GCS lifecycle rules only express whole
 * days, so this sweep is what actually enforces the minutes-scale TTL.
 */
@Injectable()
export class PdfExportsSweepService {
  private readonly logger = new Logger(PdfExportsSweepService.name)

  constructor(@Inject(PDF_EXPORTS_BUCKET) private readonly bucket: Bucket | null) {}

  async sweepExpiredExports(now = new Date()): Promise<PdfExportsSweepResult> {
    if (this.bucket === null) {
      this.logger.log(
        "No GCS bucket configured (GCS_STORAGE_BUCKET_NAME unset); skipping the PDF export sweep.",
      )
      return { scanned: 0, deleted: 0, failed: 0, skipped: true }
    }

    const prefix = getPdfExportTmpPrefix()
    const maxAgeSeconds = getPdfExportTtlMinutes() * 60 + PDF_EXPORTS_DELETE_GRACE_SECONDS
    const cutoff = new Date(now.getTime() - maxAgeSeconds * 1000)

    let scanned = 0
    let deleted = 0
    let failed = 0
    let withoutCreationDate = 0
    let pageToken: string | undefined

    for (let pageIndex = 0; pageIndex < PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN; pageIndex += 1) {
      const [files, nextQuery] = await this.bucket.getFiles({
        prefix,
        autoPaginate: false,
        maxResults: PDF_EXPORTS_SWEEP_PAGE_SIZE,
        pageToken,
      })
      scanned += files.length

      const expiredFiles: File[] = []
      for (const file of files) {
        const createdAt = parseTimeCreated(file)
        if (createdAt === undefined) {
          withoutCreationDate += 1
          continue
        }
        if (createdAt < cutoff) {
          expiredFiles.push(file)
        }
      }

      const pageCounts = await this.deleteFiles(expiredFiles)
      deleted += pageCounts.deleted
      failed += pageCounts.failed

      // `nextQuery` is undefined (and carries no page token) on the last page.
      const nextPageToken = (nextQuery as { pageToken?: string } | undefined)?.pageToken
      if (nextPageToken === undefined) {
        pageToken = undefined
        break
      }
      pageToken = nextPageToken
    }

    if (pageToken !== undefined) {
      this.logger.warn(
        `PDF export sweep stopped after ${PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN} page(s); remaining objects are swept on the next run.`,
      )
    }
    this.logger.log(
      `PDF export sweep finished under ${prefix} (scanned ${scanned}, deleted ${deleted}, failed ${failed}, without creation date ${withoutCreationDate}).`,
    )

    return { scanned, deleted, failed, skipped: false }
  }

  private async deleteFiles(files: File[]): Promise<{ deleted: number; failed: number }> {
    let deleted = 0
    let failed = 0

    for (
      let chunkStart = 0;
      chunkStart < files.length;
      chunkStart += PDF_EXPORTS_DELETE_CHUNK_SIZE
    ) {
      const chunk = files.slice(chunkStart, chunkStart + PDF_EXPORTS_DELETE_CHUNK_SIZE)
      const outcomes = await Promise.allSettled(
        chunk.map((file) => file.delete({ ignoreNotFound: true })),
      )
      outcomes.forEach((outcome, indexInChunk) => {
        if (outcome.status === "fulfilled") {
          deleted += 1
          return
        }
        failed += 1
        const reason =
          outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
        const fileName = chunk[indexInChunk]?.name ?? "unknown"
        this.logger.warn(`Failed to delete expired PDF export ${fileName}: ${reason}`)
      })
    }

    return { deleted, failed }
  }
}

/** Creation date from the object metadata, `undefined` when it is missing or unparseable. */
function parseTimeCreated(file: File): Date | undefined {
  const timeCreated = file.metadata?.timeCreated
  if (timeCreated === undefined) {
    return undefined
  }
  const createdAt = new Date(timeCreated)
  return Number.isNaN(createdAt.getTime()) ? undefined : createdAt
}
