export const DOCLING_SERVE_URL_ENV = "DOCLING_SERVE_URL"
export const DEFAULT_DOCLING_SERVE_URL = "http://localhost:5001"

export function resolveDoclingServeUrl(): string {
  return process.env[DOCLING_SERVE_URL_ENV] ?? DEFAULT_DOCLING_SERVE_URL
}
