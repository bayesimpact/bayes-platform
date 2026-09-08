const DEFAULT_SWEEP_INTERVAL_SECONDS = 300 // 5 minutes
const DEFAULT_TTL_MINUTES = 15
/** GCS V4 signing caps a signed URL at seven days, and the converter rejects anything above it. */
const MAX_TTL_MINUTES = 7 * 24 * 60
const DEFAULT_TMP_PREFIX = "tmp/pdf-exports/"

function parsePositiveIntWithDefault(
  environmentVariableName: string,
  defaultValue: number,
): number {
  const rawValue = process.env[environmentVariableName]
  if (rawValue === undefined || rawValue === "") {
    return defaultValue
  }
  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${environmentVariableName} must be a positive integer.`)
  }
  return parsed
}

/** How often the BullMQ scheduler enqueues a PDF export sweep job (Bull `every` uses ms internally). */
export function getPdfExportSweepIntervalSeconds(): number {
  return parsePositiveIntWithDefault(
    "PDF_EXPORT_SWEEP_INTERVAL_SECONDS",
    DEFAULT_SWEEP_INTERVAL_SECONDS,
  )
}

/**
 * Legacy fallback only: the lifetime assumed for exports that carry no
 * `customTime` stamp because they were written before the converter set one.
 * Current exports carry their exact expiry, so this value no longer has to
 * match the converter's `PDF_EXPORT_TTL_MINUTES`. Remove once no legacy
 * object is left.
 */
export function getPdfExportTtlMinutes(): number {
  const ttlMinutes = parsePositiveIntWithDefault("PDF_EXPORT_TTL_MINUTES", DEFAULT_TTL_MINUTES)
  if (ttlMinutes > MAX_TTL_MINUTES) {
    throw new Error(`PDF_EXPORT_TTL_MINUTES must be at most ${MAX_TTL_MINUTES} (seven days).`)
  }
  return ttlMinutes
}

/**
 * Object-name prefix the sweep lists and deletes under. Validated strictly: a
 * prefix that is empty, absolute, or not directory-shaped would make the sweep
 * delete expired objects across the whole bucket, not just the exports.
 */
export function getPdfExportTmpPrefix(): string {
  const rawValue = process.env.PDF_EXPORT_TMP_PREFIX
  const prefix = rawValue === undefined ? DEFAULT_TMP_PREFIX : rawValue

  if (prefix === "") {
    throw new Error("PDF_EXPORT_TMP_PREFIX must not be empty (it would sweep the whole bucket).")
  }
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
