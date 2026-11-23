import type { AnySchemaRoute } from "@caseai-connect/desk-contracts"
import type { INestApplication } from "@nestjs/common/interfaces"
import request from "supertest"
import type { App } from "supertest/types"
import type { z } from "zod"

// Helper function to call a route declared with `defineSchemaRoute` in tests
export const testSchemaRequester =
  (app: INestApplication<App>) =>
  async <T extends AnySchemaRoute>(params: {
    route: T
    pathParams?: Record<string, string>
    token?: string
    query?: Record<string, string>
    /** Sent as given: the caller passes the `{ payload }` envelope. */
    body?: unknown
  }): Promise<Omit<request.Response, "body"> & { body: z.output<T["schemas"]["response"]> }> => {
    const { token, route } = params

    const path = route.getPath(params.pathParams)

    // Avoid pooled keep-alive connections: under a full suite load, reuse can
    // rarely yield ECONNRESET / "socket hang up" (notably on SSE routes).
    const req = request(app.getHttpServer())[route.method](path).set("Connection", "close")

    if (params.query) {
      req.query(params.query)
    }

    if (params.body !== undefined) {
      req.send(params.body as string | object)
    }

    if (token) req.set("Authorization", `Bearer ${token}`)

    return (await req) as Omit<request.Response, "body"> & {
      body: z.output<T["schemas"]["response"]>
    }
  }

export type SchemaRequester = ReturnType<typeof testSchemaRequester>

/** Checks the status, and that the body is exactly what the route's response schema keeps. */
export const expectSchemaResponse = (
  route: AnySchemaRoute,
  response: request.Response,
  status: number = 200,
) => {
  expect(response.status).toBe(status)
  expect(response.body).toStrictEqual(route.schemas.response.parse(response.body))
}
