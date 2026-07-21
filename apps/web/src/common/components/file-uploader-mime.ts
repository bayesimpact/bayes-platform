import type { AllowedMimeTypes } from "@caseai-connect/api-contracts"

// Extension hints for MIME types that OS file pickers don't reliably map to
// extensions (e.g. `.md` has no registered MIME type on most platforms, so a
// MIME-only `accept` attribute would grey out Markdown files in the dialog).
const EXTENSION_HINTS_BY_MIME_TYPE: Record<string, string[]> = {
  "text/markdown": [".md", ".markdown"],
}

/** Builds the react-dropzone `accept` object from the allowed MIME type flags. */
export function buildAccept(
  allowedMimeTypes: Partial<Record<(typeof AllowedMimeTypes)[number], boolean>>,
): Record<string, string[]> {
  return Object.keys(allowedMimeTypes)
    .filter((mimeType) => allowedMimeTypes[mimeType as (typeof AllowedMimeTypes)[number]])
    .reduce(
      (accept, mimeType) => {
        accept[mimeType] = EXTENSION_HINTS_BY_MIME_TYPE[mimeType] ?? []
        return accept
      },
      {} as Record<string, string[]>,
    )
}
