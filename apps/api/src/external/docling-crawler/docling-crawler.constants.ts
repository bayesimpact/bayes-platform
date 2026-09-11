export const DOCLING_SERVE_URL_ENV = "DOCLING_SERVE_URL"

export function resolveDoclingServeUrl(): string {
  const doclingServeUrl = process.env[DOCLING_SERVE_URL_ENV]
  if (!doclingServeUrl) {
    throw new Error(`${DOCLING_SERVE_URL_ENV} environment variable is not set`)
  }
  return doclingServeUrl
}
