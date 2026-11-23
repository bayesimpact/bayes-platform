/** The bytes of a kilobyte: the contracts set their limits in binary units (`25 * 1024 * 1024`). */
const KILOBYTE = 1024

/**
 * A file's size in the person's language: "0.8 kB", "2.4 MB"; a few bytes read in kilobytes. A
 * limit of the contracts (`EXTRACTION_MAX_BYTES`) reads through it too, so its text follows them,
 * and counts in the same binary units, so 25 × 1024 × 1024 bytes read "25 MB".
 */
export function fileSizeOf(bytes: number, locale: string): string {
  const { unit, size } =
    bytes >= KILOBYTE * KILOBYTE
      ? { unit: "megabyte", size: KILOBYTE * KILOBYTE }
      : { unit: "kilobyte", size: KILOBYTE }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: bytes >= 10 * size ? 0 : 1,
  }).format(bytes / size)
}
