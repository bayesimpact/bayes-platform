import { randomUUID } from "node:crypto"
import type { AnySchemaRoute, AnyStreamRoute } from "@caseai-connect/eval-contracts"
import * as evalContracts from "@caseai-connect/eval-contracts"
import type { INestApplication } from "@nestjs/common"
import supertest from "supertest"
import type { App } from "supertest/types"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { setupE2eTestDatabase, teardownE2eTestDatabase } from "@/common/test/test-database"
import { setupUserGuardForTesting } from "../../../test/e2e.helpers"
import { expectResponse } from "../../../test/request"
import { EvalModule } from "./eval.module"

type EvalRoute = AnySchemaRoute | AnyStreamRoute

/**
 * Every route of the Evaluation contracts, read from the package's `*Routes` exports so a route added
 * later is covered with no change here.
 */
const EVAL_ROUTES: EvalRoute[] = Object.entries(evalContracts)
  .filter(([exportName]) => exportName.endsWith("Routes"))
  .flatMap(([, routeGroup]) => Object.values(routeGroup as Record<string, EvalRoute>))

/** The route's URL, with a random UUID for each `:name` segment. */
const toUrl = (route: EvalRoute): string => {
  const pathParams = Object.fromEntries(
    [...route.path.matchAll(/:(\w+)/g)].map((segment) => [segment[1], randomUUID()]),
  )
  return route.getPath(pathParams)
}

describe("Evaluation routes", () => {
  let app: INestApplication<App>
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [EvalModule],
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
    expect(EVAL_ROUTES.length).toBeGreaterThan(0)
    expect(EVAL_ROUTES).toContain(evalContracts.EvalConversationsRoutes.streamReply)
    const methodsAndPaths = EVAL_ROUTES.map((route) => `${route.method} ${route.path}`)
    expect(new Set(methodsAndPaths).size).toBe(methodsAndPaths.length)
  })

  // A route with no handler answers 404. Authentication runs before anything else on a handler,
  // so a 401 proves that the route has one.
  it.each(
    EVAL_ROUTES.map((route) => [`${route.method.toUpperCase()} ${route.path}`, route]),
  )("%s starts with /eval/ and has a handler", async (_name, route) => {
    expect(route.path.startsWith("/eval/")).toBe(true)

    const response = await supertest(app.getHttpServer())
      [route.method](toUrl(route))
      .set("Connection", "close")

    expectResponse(response, 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })
})
