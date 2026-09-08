import { readPositiveIntEnv } from "@/config/positive-int-env"

const DEFAULT_SWEEP_INTERVAL_SECONDS = 300 // 5 minutes
const DEFAULT_TTL_MINUTES = 15
/** GCS V4 signing caps a signed URL at seven days, and the converter rejects anything above it. */
const MAX_TTL_MINUTES = 7 * 24 * 60
const DEFAULT_TMP_PREFIX = "tmp/pdf-exports/"

/** How often the BullMQ scheduler enqueues a PDF export sweep job (Bull `every` uses ms internally). */
export function getPdfExportSweepIntervalSeconds(): number {
  return readPositiveIntEnv("PDF_EXPORT_SWEEP_INTERVAL_SECONDS", {
    defaultValue: DEFAULT_SWEEP_INTERVAL_SECONDS,
  })
}

/**
 * Legacy fallback only: the lifetime assumed for exports that carry no
 * `customTime` stamp because they were written before the converter set one.
 * Current exports carry their exact expiry, so this value no longer has to
 * match the converter's `PDF_EXPORT_TTL_MINUTES`. Remove once no legacy
 * object is left. Parsed like the converter's `strconv.Atoi`, so "15m" or
 * "1.5" are rejected here as well instead of truncating to 15 or 1.
 */
export function getPdfExportTtlMinutes(): number {
  const ttlMinutes = readPositiveIntEnv("PDF_EXPORT_TTL_MINUTES", {
    defaultValue: DEFAULT_TTL_MINUTES,
  })
  if (ttlMinutes > MAX_TTL_MINUTES) {
    throw new Error(`PDF_EXPORT_TTL_MINUTES must be at most ${MAX_TTL_MINUTES} (seven days).`)
  }
  return ttlMinutes
}

/**
 * Object-name prefix the sweep lists and deletes under. An unset or empty
 * variable falls back to the default, matching the converter. A non-empty
 * value is validated strictly: a prefix that is absolute or not
 * directory-shaped would make the sweep delete expired objects across the
 * whole bucket, not just the exports.
 */
export function getPdfExportTmpPrefix(): string {
  const rawValue = process.env.PDF_EXPORT_TMP_PREFIX
  const prefix = rawValue === undefined || rawValue === "" ? DEFAULT_TMP_PREFIX : rawValue

  if (prefix === "/" || prefix.startsWith("/")) {
    throw new Error(
      "PDF_EXPORT_TMP_PREFIX must be a relative object prefix, without a leading slash.",
    )
  }
  if (prefix.includes("..")) {
    throw new Error('PDF_EXPORT_TMP_PREFIX must not contain "..".')
  }
  if (!prefix.endsWith("/")) {
    throw new Error('PDF_EXPORT_TMP_PREFIX must end with "/" so it only matches its own folder.')
  }

  return prefix
}
