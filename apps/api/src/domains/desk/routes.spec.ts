import { randomUUID } from "node:crypto"
import type { AnySchemaRoute, AnyStreamRoute } from "@bayes-platform/desk-contracts"
import * as deskContracts from "@bayes-platform/desk-contracts"
import type { INestApplication } from "@nestjs/common"
import supertest from "supertest"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { setupE2eTestDatabase, teardownE2eTestDatabase } from "@/common/test/test-database"
import { setupUserGuardForTesting } from "../../../test/e2e.helpers"
import { expectResponse } from "../../../test/request"
import { DeskModule } from "./desk.module"

type DeskRoute = AnySchemaRoute | AnyStreamRoute

/**
 * Every route of the Desk contracts, read from the package's `*Routes` exports so a route added
 * later is covered with no change here.
 */
const DESK_ROUTES: DeskRoute[] = Object.entries(deskContracts)
  .filter(([exportName]) => exportName.endsWith("Routes"))
  .flatMap(([, routeGroup]) => Object.values(routeGroup as Record<string, DeskRoute>))

/** The route's URL, with a random UUID for each `:name` segment. */
const toUrl = (route: DeskRoute): string => {
  const pathParams = Object.fromEntries(
    [...route.path.matchAll(/:(\w+)/g)].map((segment) => [segment[1], randomUUID()]),
  )
  return route.getPath(pathParams)
}

describe("Desk routes", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [DeskModule],
      applyOverrides: (moduleBuilder) =>
        setupUserGuardForTesting(moduleBuilder, () => `oidc|${randomUUID()}`),
    })
    app = setup.module.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  it("reads every route of the contracts, the reply stream included", () => {
    expect(DESK_ROUTES.length).toBeGreaterThan(0)
    expect(DESK_ROUTES).toContain(deskContracts.DeskConversationsRoutes.streamReply)
  })

  // A route with no handler answers 404. Authentication runs before anything else on a handler,
  // so a 401 proves that the route has one.
  it.each(
    DESK_ROUTES.map((route) => [`${route.method.toUpperCase()} ${route.path}`, route]),
  )("%s starts with /desk/ and has a handler", async (_name, route) => {
    expect(route.path.startsWith("/desk/")).toBe(true)

    const response = await supertest(app.getHttpServer())
      [route.method](toUrl(route))
      .set("Connection", "close")

    expectResponse(response, 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })
})
