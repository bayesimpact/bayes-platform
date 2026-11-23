import { describe, expect, it } from "vitest"
import {
  BackofficeAgentRoutes,
  BackofficeOrganizationRoutes,
  BackofficePermissionsRoutes,
  BackofficeProjectRoutes,
  BackofficeRoutes,
  BackofficeUserRoutes,
} from "@/backoffice/routes/helpers"
import { StudioRoutes } from "@/studio/routes/helpers"
import { RouteNames } from "./helpers"

/**
 * On one origin the API owns `/api` and `/public` (apps/api/src/config/api-prefix.ts).
 * A client route under either prefix would never reach the SPA.
 */
const RESERVED_PREFIXES = ["/api", "/public"]

const clientPaths: string[] = [
  ...Object.values(RouteNames),
  ...[
    BackofficeRoutes,
    BackofficeUserRoutes,
    BackofficeOrganizationRoutes,
    BackofficeAgentRoutes,
    BackofficeProjectRoutes,
    BackofficePermissionsRoutes,
    StudioRoutes,
  ].flatMap((routes) => Object.values(routes).map((route) => route.path)),
]

describe("client routes", () => {
  it("never start with a prefix reserved by the API", () => {
    const offending = clientPaths.filter((path) =>
      RESERVED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)),
    )
    expect(clientPaths.length).toBeGreaterThan(10)
    expect(offending).toEqual([])
  })
})
