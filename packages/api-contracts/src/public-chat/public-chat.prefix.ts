/**
 * Namespace for endpoints callable from arbitrary host pages (embed widget).
 * The API selects its open CORS policy on this prefix (ADR 0015), and their
 * security is enforced by EmbedTokenGuard, not by CORS. Renaming it breaks
 * deployed embed snippets. Shared by every major: `/public/v1/...`, `/public/v2/...`.
 */
export const PUBLIC_PATH_PREFIX = "public"

/** `"1.0"` gives `"v1"`: the path segment a version string belongs to. */
export type MajorOf<Version extends string> = Version extends `${infer Major}.${string}`
  ? `v${Major}`
  : never
