import { Inject, Injectable, Logger } from "@nestjs/common"
import { getPdfExportTmpPrefix, getPdfExportTtlMinutes } from "./pdf-exports.config"
import {
  PDF_EXPORTS_BUCKET,
  PDF_EXPORTS_DELETE_CHUNK_SIZE,
  PDF_EXPORTS_DELETE_GRACE_SECONDS,
  PDF_EXPORTS_SWEEP_MAX_PAGES_PER_RUN,
  PDF_EXPORTS_SWEEP_PAGE_SIZE,
} from "./pdf-exports.constants"
import type { PdfExportsBucket, PdfExportsObject } from "./pdf-exports-bucket"

export type PdfExportsSweepResult = {
  scanned: number
  deleted: number
  failed: number
  skipped: boolean
}

/**
 * Deletes temporary PDF exports written by `apps/pdf-converter` once their
 * signed download URLs have expired. Bucket lifecycle rules only express whole
 * days, so this sweep is what actually enforces the minutes-scale TTL.
 *
 * The converter writes each export under `<prefix><expiry in Unix seconds>-<id>/`,
 * so the writer alone decides when an export dies, the sweep never has to agree
 * with it on a TTL, and a plain listing is enough on any storage. Objects whose
 * name carries no expiry were written before that naming and fall back to their
 * creation date plus the locally configured TTL.
 */
@Injectable()
export class PdfExportsSweepService {
  private readonly logger = new Logger(PdfExportsSweepService.name)

  constructor(@Inject(PDF_EXPORTS_BUCKET) private readonly bucket: PdfExportsBucket | null) {}

  async sweepExpiredExports(now = new Date()): Promise<PdfExportsSweepResult> {
    if (this.bucket === null) {
      this.logger.log("No bucket configured (local file storage); skipping the PDF export sweep.")
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
      const page = await this.bucket.listPage({
        prefix,
        pageSize: PDF_EXPORTS_SWEEP_PAGE_SIZE,
        pageToken,
      })
      scanned += page.objects.length

      const expiredObjects: PdfExportsObject[] = []
      for (const object of page.objects) {
        const expiresAt = parseExpiryFromName(object.name, prefix)
        if (expiresAt !== undefined) {
          if (expiresAt < expiryCutoff) {
            expiredObjects.push(object)
          }
          continue
        }
        // Legacy fallback for objects written before the expiry was in the
        // name; it can be removed once no such object is left.
        if (object.createdAt === undefined) {
          withoutExpiry += 1
          continue
        }
        if (object.createdAt < legacyCreationCutoff) {
          expiredObjects.push(object)
        }
      }

      const pageCounts = await this.deleteObjects(this.bucket, expiredObjects)
      deleted += pageCounts.deleted
      failed += pageCounts.failed

      pageToken = page.nextPageToken
      if (pageToken === undefined) {
        break
      }
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

  private async deleteObjects(
    bucket: PdfExportsBucket,
    objects: PdfExportsObject[],
  ): Promise<{ deleted: number; failed: number }> {
    let deleted = 0
    let failed = 0

    for (
      let chunkStart = 0;
      chunkStart < objects.length;
      chunkStart += PDF_EXPORTS_DELETE_CHUNK_SIZE
    ) {
      const chunk = objects.slice(chunkStart, chunkStart + PDF_EXPORTS_DELETE_CHUNK_SIZE)
      const outcomes = await Promise.allSettled(chunk.map((object) => bucket.delete(object.name)))
      outcomes.forEach((outcome, indexInChunk) => {
        if (outcome.status === "fulfilled") {
          deleted += 1
          return
        }
        failed += 1
        const reason =
          outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
        const objectName = chunk[indexInChunk]?.name ?? "unknown"
        this.logger.warn(`Failed to delete expired PDF export ${objectName}: ${reason}`)
      })
    }

    return { deleted, failed }
  }
}

/** URL expiry the converter put in the object name, `undefined` for a legacy name. */
export function parseExpiryFromName(name: string, prefix: string): Date | undefined {
  if (!name.startsWith(prefix)) {
    return undefined
  }
  const match = /^(\d+)-[^/]+\//.exec(name.slice(prefix.length))
  if (!match?.[1]) {
    return undefined
  }
  return new Date(Number(match[1]) * 1000)
}
