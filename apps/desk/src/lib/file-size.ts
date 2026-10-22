/**
 * A file's size in the person's language: "0.8 kB", "2.4 MB"; a few bytes read in kilobytes. A
 * limit of the contracts (`EXTRACTION_MAX_BYTES`) reads through it too, so its text follows them.
 */
export function fileSizeOf(bytes: number, locale: string): string {
  const { unit, size } =
    bytes >= 1000 * 1000
      ? { unit: "megabyte", size: 1000 * 1000 }
      : { unit: "kilobyte", size: 1000 }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: bytes >= 10 * size ? 0 : 1,
  }).format(bytes / size)
}
