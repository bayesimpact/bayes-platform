import { randomUUID } from "node:crypto"
import { defineSchemaRoute, defineStreamRoute } from "@bayes-platform/schema-route"
import { Controller, HttpStatus, type INestApplication, Logger, Module, Req } from "@nestjs/common"
import type { Request } from "express"
import type { App } from "supertest/types"
import { z } from "zod"
import {
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { AuthModule } from "@/domains/auth/auth.module"
import { UsersModule } from "@/domains/users/users.module"
import { setupUserGuardForTesting } from "../../../test/e2e.helpers"
import {
  expectSchemaResponse,
  type SchemaRequester,
  testSchemaRequester,
} from "../../../test/schema-request"
import { RouteInput } from "./route-input.decorator"
import { SchemaRoute } from "./schema-route.decorator"
import type { SchemaRouteInput, SchemaRouteResponse } from "./schema-route.types"

const updateFixtureRoute = defineSchemaRoute({
  method: "post",
  path: "fixtures/:fixtureId",
  params: z.strictObject({ fixtureId: z.uuid() }),
  body: z.strictObject({ name: z.string() }),
  response: z.object({ id: z.uuid() }),
})

const resetFixtureRoute = defineSchemaRoute({
  method: "post",
  path: "fixtures/:fixtureId/reset",
  // The transform makes the parsed params differ from the raw ones, so a spec can tell them apart.
  params: z.strictObject({ fixtureId: z.uuid().transform((fixtureId) => fixtureId.toLowerCase()) }),
  response: z.object({ id: z.uuid(), parsedId: z.uuid() }),
})

/** Answers for the update route. A spec can make it return a response the schema rejects. */
const answerUpdate = jest.fn((input: SchemaRouteInput<typeof updateFixtureRoute>): unknown => ({
  data: { id: input.params.fixtureId, secret: "not in the contract" },
}))

/** The body of a 400 from the input guard. */
type InvalidRequestBody = {
  statusCode: number
  message: string
  error: string
  issues: Array<{ path: (string | number)[]; code: string; message: string }>
}

const invalidRequestBody = (response: { body: unknown }) => response.body as InvalidRequestBody

@Controller()
class SchemaRouteFixtureController {
  @SchemaRoute(updateFixtureRoute, { permission: "signed-in" })
  update(
    @RouteInput() input: SchemaRouteInput<typeof updateFixtureRoute>,
  ): SchemaRouteResponse<typeof updateFixtureRoute> {
    return answerUpdate(input) as SchemaRouteResponse<typeof updateFixtureRoute>
  }

  @SchemaRoute(resetFixtureRoute, { permission: "signed-in" })
  reset(
    @RouteInput() input: SchemaRouteInput<typeof resetFixtureRoute>,
    @Req() request: Request,
  ): SchemaRouteResponse<typeof resetFixtureRoute> {
    return { data: { id: String(request.params.fixtureId), parsedId: input.params.fixtureId } }
  }
}

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [SchemaRouteFixtureController],
})
class SchemaRouteFixtureModule {}

describe("SchemaRoute", () => {
  let app: INestApplication<App>
  let request: SchemaRequester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [SchemaRouteFixtureModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    app = setup.module.createNestApplication()
    await app.init()
    request = testSchemaRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    answerUpdate.mockClear()
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const updateFixture = (params: { fixtureId: string; body?: unknown }) =>
    request({
      route: updateFixtureRoute,
      pathParams: { fixtureId: params.fixtureId },
      token: accessToken,
      body: params.body,
    })

  it("answers 400 with issues for an id that is not a UUID", async () => {
    const response = await updateFixture({
      fixtureId: "not-a-uuid",
      body: { payload: { name: "Helpful Assistant" } },
    })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({
      statusCode: 400,
      message: "Invalid request",
      error: "Bad Request",
    })
    expect(invalidRequestBody(response).issues[0]).toMatchObject({
      path: ["params", "fixtureId"],
      code: "invalid_format",
    })
    expect(answerUpdate).not.toHaveBeenCalled()
  })

  it("answers 400 for a body key the schema does not declare", async () => {
    const response = await updateFixture({
      fixtureId: randomUUID(),
      body: { payload: { name: "Helpful Assistant", extra: "Product" } },
    })

    expect(response.status).toBe(400)
    expect(invalidRequestBody(response).issues).toEqual([
      expect.objectContaining({ path: ["body", "payload"], code: "unrecognized_keys" }),
    ])
    expect(answerUpdate).not.toHaveBeenCalled()
  })

  it("answers 400 for a query key when the route declares none", async () => {
    const response = await request({
      route: resetFixtureRoute,
      pathParams: { fixtureId: randomUUID() },
      token: accessToken,
      query: { extra: "Pricing" },
    })

    expect(response.status).toBe(400)
    expect(invalidRequestBody(response).issues).toEqual([
      expect.objectContaining({ path: ["query"], code: "unrecognized_keys" }),
    ])
  })

  it("answers 401 before 400 when there is no token", async () => {
    accessToken = undefined

    const response = await updateFixture({ fixtureId: "not-a-uuid", body: { extra: "Support" } })

    expect(response.status).toBe(401)
  })

  it("accepts a POST with no body on a route that reads none", async () => {
    const fixtureId = randomUUID()

    const response = await request({
      route: resetFixtureRoute,
      pathParams: { fixtureId },
      token: accessToken,
    })

    expectSchemaResponse(resetFixtureRoute, response, 201)
  })

  it("gives the handler the parsed params and payload", async () => {
    const fixtureId = randomUUID()

    const response = await updateFixture({
      fixtureId,
      body: { payload: { name: "Helpful Assistant" } },
    })

    expect(response.status).toBe(201)
    expect(answerUpdate).toHaveBeenCalledWith({
      params: { fixtureId },
      query: {},
      payload: { name: "Helpful Assistant" },
    })
  })

  it("leaves request.params as Express gave them", async () => {
    const fixtureId = randomUUID().toUpperCase()

    const response = await request({
      route: resetFixtureRoute,
      pathParams: { fixtureId },
      token: accessToken,
    })

    expectSchemaResponse(resetFixtureRoute, response, 201)
    expect(response.body.data).toEqual({ id: fixtureId, parsedId: fixtureId.toLowerCase() })
  })

  it("strips a response field the schema does not declare", async () => {
    const fixtureId = randomUUID()

    const response = await updateFixture({
      fixtureId,
      body: { payload: { name: "Helpful Assistant" } },
    })

    expectSchemaResponse(updateFixtureRoute, response, 201)
    expect(response.body).toStrictEqual({ data: { id: fixtureId } })
  })

  it("answers 500 and logs when the response breaks the schema", async () => {
    const loggerError = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined)
    answerUpdate.mockReturnValueOnce({ data: { id: "not-a-uuid" } })

    try {
      const response = await updateFixture({
        fixtureId: randomUUID(),
        body: { payload: { name: "Helpful Assistant" } },
      })

      expect(response.status).toBe(500)
      expect(loggerError).toHaveBeenCalledWith(
        expect.stringMatching(/POST \/fixtures\/:fixtureId.*data\.id/),
      )
    } finally {
      loggerError.mockRestore()
    }
  })

  it("logs (root) when the whole response breaks the schema", async () => {
    const loggerError = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined)
    answerUpdate.mockReturnValueOnce(null)

    try {
      const response = await updateFixture({
        fixtureId: randomUUID(),
        body: { payload: { name: "Helpful Assistant" } },
      })

      expect(response.status).toBe(500)
      expect(loggerError).toHaveBeenCalledWith(
        expect.stringMatching(/breaks its schema at: \(root\)$/),
      )
    } finally {
      loggerError.mockRestore()
    }
  })
})

describe("SchemaRoute options", () => {
  const streamFixtureRoute = defineStreamRoute({
    method: "post",
    path: "fixtures/:fixtureId/stream",
    params: z.strictObject({ fixtureId: z.uuid() }),
    event: z.object({ type: z.literal("end") }),
  })

  it("refuses a scoped permission with no context", () => {
    expect(() =>
      SchemaRoute(updateFixtureRoute, { permission: { key: "agent.read", on: "agent" } }),
    ).toThrow("/fixtures/:fixtureId: a scoped permission needs a context")
  })

  it("refuses a scoped permission with an empty context", () => {
    expect(() =>
      SchemaRoute(updateFixtureRoute, {
        permission: { key: "agent.read", on: "agent" },
        context: [],
      }),
    ).toThrow("/fixtures/:fixtureId: a scoped permission needs a context")
  })

  it('refuses "signed-in" with a context', () => {
    expect(() =>
      SchemaRoute(updateFixtureRoute, { permission: "signed-in", context: ["organization"] }),
    ).toThrow('/fixtures/:fixtureId: a "signed-in" route loads no context')
  })

  it("accepts a scoped permission with its context", () => {
    expect(() =>
      SchemaRoute(updateFixtureRoute, {
        permission: { key: "agent.read", on: "agent" },
        context: ["organization", "project", "agent"],
      }),
    ).not.toThrow()
  })

  it("refuses an activity on a stream route", () => {
    expect(() =>
      SchemaRoute(streamFixtureRoute, {
        permission: "signed-in",
        activity: { action: "conversationAgentSession.create" },
      }),
    ).toThrow("/fixtures/:fixtureId/stream: a stream route records no activity")
  })

  it("refuses a status other than 200 on a stream route", () => {
    expect(() =>
      SchemaRoute(streamFixtureRoute, { permission: "signed-in", status: HttpStatus.CREATED }),
    ).toThrow("/fixtures/:fixtureId/stream: a stream route answers 200")
  })
})
