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
 *
 * The converter stamps each export's URL expiry on the object as its GCS
 * `customTime`, so the writer alone decides when an export dies and the sweep
 * never has to agree with it on a TTL. Objects without `customTime` were
 * written before that stamp existed and fall back to `timeCreated` plus the
 * locally configured TTL.
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
    const graceMilliseconds = PDF_EXPORTS_DELETE_GRACE_SECONDS * 1000
    // Delete once the expiry plus the grace period is in the past.
    const expiryCutoff = new Date(now.getTime() - graceMilliseconds)
    const legacyTtlMilliseconds = getPdfExportTtlMinutes() * 60 * 1000
    const legacyCreationCutoff = new Date(expiryCutoff.getTime() - legacyTtlMilliseconds)

    let scanned = 0
    let deleted = 0
    let failed = 0
    let withoutExpiry = 0
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
        const expiresAt = parseCustomTime(file)
        if (expiresAt !== undefined) {
          if (expiresAt < expiryCutoff) {
            expiredFiles.push(file)
          }
          continue
        }
        // Legacy fallback for objects written before the converter stamped
        // the expiry; it can be removed once no such object is left.
        const createdAt = parseTimeCreated(file)
        if (createdAt === undefined) {
          withoutExpiry += 1
          continue
        }
        if (createdAt < legacyCreationCutoff) {
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
      `PDF export sweep finished under ${prefix} (scanned ${scanned}, deleted ${deleted}, failed ${failed}, without expiry or creation date ${withoutExpiry}).`,
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

/** URL expiry the converter stamped as the GCS custom time, `undefined` when missing or unparseable. */
function parseCustomTime(file: File): Date | undefined {
  return parseMetadataDate(file.metadata?.customTime)
}

/** Creation date from the object metadata, `undefined` when it is missing or unparseable. */
function parseTimeCreated(file: File): Date | undefined {
  return parseMetadataDate(file.metadata?.timeCreated)
}

function parseMetadataDate(rawValue: string | undefined): Date | undefined {
  if (rawValue === undefined) {
    return undefined
  }
  const parsed = new Date(rawValue)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}
