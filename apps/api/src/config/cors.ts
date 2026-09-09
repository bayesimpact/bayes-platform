import { PUBLIC_PATH_PREFIX } from "@caseai-connect/api-contracts"
import type {
  CorsOptions,
  CorsOptionsDelegate,
} from "@nestjs/common/interfaces/external/cors-options.interface"

const DEFAULT_LOCAL_FRONTEND_URLS = [
  // `vite dev` and `vite preview` — see apps/web/vite.config.ts.
  "https://connect.localhost:5173",
  "https://connect.localhost:5174",
]

/**
 * Parses `FRONTEND_URL` into a list of CORS origins. Accepts a single URL or
 * a comma-separated list. Each entry is trimmed and normalized to https://
 * if no scheme is given. When the list resolves to nothing (unset or blank)
 * outside production, falls back to the local dev/preview URLs so a fresh
 * checkout works without extra `.env` setup. In production the same case
 * throws: an empty list would silently block every browser call to the
 * platform, whereas a crash at boot fails the Cloud Run revision and keeps
 * the previous one serving.
 */
export function parseFrontendUrls(
  frontendUrl: string | undefined,
  isProduction: boolean,
): string[] {
  const urls = (frontendUrl ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) =>
      url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`,
    )
  if (urls.length > 0) {
    return urls
  }
  if (isProduction) {
    throw new Error(
      "FRONTEND_URL must be set in production (comma-separated list of allowed CORS origins)",
    )
  }
  return DEFAULT_LOCAL_FRONTEND_URLS
}

/**
 * CORS strategy — two policies, split by path (#366):
 * - Public embed endpoints (/public/*) are designed to be called from
 *   arbitrary host pages, so the request origin is reflected. Their security
 *   is enforced by EmbedTokenGuard (embed token + per-config allowedOrigins
 *   check), not by CORS. Reflecting the origin (instead of '*') is required
 *   because some browsers are stricter with '*' when custom headers
 *   (X-Session-Token) are present.
 * - Everything else only serves the platform front ends, so origins are
 *   pinned to the FRONTEND_URL list. These endpoints are secured by Auth0
 *   Bearer tokens; the one cookie-authenticated surface (Bull Board's OIDC
 *   session) is covered by this strict policy too.
 * No caller sends cookies or uses `credentials: 'include'`, so credentialed
 * CORS stays off.
 */
export function buildCorsOptionsDelegate(
  frontendUrls: string[],
): CorsOptionsDelegate<{ url?: string }> {
  return (req, callback: (error: Error | null, options: CorsOptions) => void) => {
    const isPublicEmbed = req.url?.startsWith(`/${PUBLIC_PATH_PREFIX}/`) ?? false
    callback(null, { origin: isPublicEmbed ? true : frontendUrls })
  }
}
