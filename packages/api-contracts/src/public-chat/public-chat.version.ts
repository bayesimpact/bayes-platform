/**
 * Version of the public chat API contract, as `major.minor`.
 * Rules: `docs/public-api-contract.md`. Bump the minor for an additive change, the
 * major for a breaking change. The major is also the path segment of the routes
 * (`/public/v1/...`), see `PUBLIC_API_MAJOR`.
 */
export const PUBLIC_API_VERSION = "1.0"

/** `"1.0"` gives `"v1"`: the path segment a version string belongs to. */
type MajorOf<Version extends string> = Version extends `${infer Major}.${string}`
  ? `v${Major}`
  : never

/**
 * Path segment that carries the major version of the public routes. A literal, so the
 * routes never move on their own: bumping `PUBLIC_API_VERSION` to `2.0` fails typecheck
 * here until a maintainer decides how v2 is served (`docs/public-api-contract.md`,
 * "Shipping a new major version").
 */
export const PUBLIC_API_MAJOR: MajorOf<typeof PUBLIC_API_VERSION> = "v1"
