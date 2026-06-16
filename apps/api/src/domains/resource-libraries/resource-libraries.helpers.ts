/** Returns the lowercased extension of a file name, or "bin" when none is present. */
export function extractResourceFileExtension(fileName: string): string {
  const parts = fileName.split(".")
  if (parts.length < 2) return "bin"
  return (parts.pop() ?? "bin").toLowerCase()
}

/** Trims and collapses whitespace in an uploaded file name, falling back to a default. */
export function normalizeResourceFileName(originalFileName: string): string {
  const normalized = originalFileName.trim().replace(/\s+/g, " ")
  return normalized.length > 0 ? normalized : "file"
}
