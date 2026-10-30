import type { MajorOf } from "../public-chat.prefix"

/**
 * Version of the public chat API contract v1, as `major.minor`.
 * Rules: `docs/public-api-contract.md`. Bump the minor for a change to v1. Each served
 * major has its own constant, so the majors bump independently.
 */
export const PUBLIC_API_V1_VERSION = "1.2"

/**
 * Path segment of the v1 routes (`/public/v1/...`). A literal, so the routes never move on
 * their own: a version string of another major fails typecheck here.
 */
export const PUBLIC_API_V1_MAJOR: MajorOf<typeof PUBLIC_API_V1_VERSION> = "v1"
