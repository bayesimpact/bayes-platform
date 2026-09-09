/**
 * Version of the public chat API contract, as `major.minor`.
 * Rules: `docs/public-api-contract.md`. Bump the minor for an additive change, the
 * major for a breaking change. The major is also the path segment of the routes
 * (`/public/v1/...`), see `PUBLIC_API_MAJOR`.
 */
export const PUBLIC_API_VERSION = "1.0"

/** Path segment that carries the major version of the public routes. */
export const PUBLIC_API_MAJOR = `v${PUBLIC_API_VERSION.split(".")[0]}` as "v1"
