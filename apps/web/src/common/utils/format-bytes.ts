const UNITS = ["B", "KB", "MB", "GB", "TB"] as const

/**
 * Formats a byte count into a human-readable size (e.g. 23376865 -> "22.3 MB").
 */
export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** exponent
  const formatted = exponent === 0 ? value.toString() : value.toFixed(fractionDigits)
  return `${formatted} ${UNITS[exponent]}`
}
