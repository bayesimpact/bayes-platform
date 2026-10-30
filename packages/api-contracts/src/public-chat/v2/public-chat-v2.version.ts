import type { MajorOf } from "../public-chat.prefix"

/**
 * Version of the public chat API contract v2, as `major.minor`.
 * Rules: `docs/public-api-contract.md`. Bump the minor for a change to v2. Each served
 * major has its own constant, so the majors bump independently.
 */
export const PUBLIC_API_V2_VERSION = "2.0"

/**
 * Path segment of the v2 routes (`/public/v2/...`). A literal, so the routes never move on
 * their own: a version string of another major fails typecheck here.
 */
export const PUBLIC_API_V2_MAJOR: MajorOf<typeof PUBLIC_API_V2_VERSION> = "v2"
