import { randomUUID } from "node:crypto"
import { defineSchemaRoute, errorOutputSchema } from "@caseai-connect/desk-contracts"
import { Controller, type INestApplication, Logger, Module } from "@nestjs/common"
import supertest from "supertest"
import type { App } from "supertest/types"
import { z } from "zod"
import { ContextModule } from "@/common/context/context.module"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { AuthModule } from "@/domains/auth/auth.module"
import { createOrganizationWithOwner } from "@/domains/organizations/organization.factory"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import {
  mockForeignAuthSubject,
  mockOidcEmailForSub,
  setupUserGuardForTesting,
} from "../../../../test/e2e.helpers"
import { ensureRbacCatalog } from "../../../../test/rbac-test.helpers"
import { expectResponse, type Requester, testRequester } from "../../../../test/request"
import { SchemaInput, type SchemaRouteInput } from "../schema-input.decorator"
import { SchemaRoute, SIGNED_IN } from "../schema-route.decorator"

/** The issues of an error body, parsed with the error schema the Desk reads. */
const readIssues = (body: unknown) => errorOutputSchema.parse(body).issues

const TestRoutes = {
  getItem: defineSchemaRoute({
    method: "get",
    path: "schema-route-test/items/:itemId",
    params: z.strictObject({ itemId: z.uuid() }),
    query: z.strictObject({ page: z.coerce.number<string>().int().min(0) }),
    response: z.object({ itemId: z.uuid(), page: z.number() }),
  }),
  createItem: defineSchemaRoute({
    method: "post",
    path: "schema-route-test/items",
    body: z.strictObject({ title: z.string().min(1) }),
    response: z.object({ title: z.string() }),
  }),
  getBroken: defineSchemaRoute({
    method: "get",
    path: "schema-route-test/broken",
    response: z.object({ count: z.number() }),
  }),
  getOrganization: defineSchemaRoute({
    method: "get",
    path: "schema-route-test/organizations/:organizationId",
    params: z.strictObject({ organizationId: z.uuid() }),
    response: z.object({ organizationId: z.uuid() }),
  }),
}

@Controller()
class SchemaRouteTestController {
  @SchemaRoute(TestRoutes.getItem, { permission: SIGNED_IN })
  getItem(
    @SchemaInput() input: SchemaRouteInput<typeof TestRoutes.getItem>,
  ): typeof TestRoutes.getItem.response {
    // A field the contract does not declare, which the interceptor must strip.
    const item = { itemId: input.params.itemId, page: input.query.page, internalNote: "hidden" }
    return { data: item }
  }

  @SchemaRoute(TestRoutes.createItem, { permission: SIGNED_IN })
  createItem(
    @SchemaInput() input: SchemaRouteInput<typeof TestRoutes.createItem>,
  ): typeof TestRoutes.createItem.response {
    return { data: { title: input.body.title } }
  }

  @SchemaRoute(TestRoutes.getBroken, { permission: SIGNED_IN })
  getBroken(): typeof TestRoutes.getBroken.response {
    // Deliberately breaks the contract: the interceptor must answer 500.
    return { data: { count: "3" } } as unknown as typeof TestRoutes.getBroken.response
  }

  @SchemaRoute(TestRoutes.getOrganization, {
    permission: { key: "organization.read", resource: "organization" },
  })
  getOrganization(
    @SchemaInput() input: SchemaRouteInput<typeof TestRoutes.getOrganization>,
  ): typeof TestRoutes.getOrganization.response {
    return { data: { organizationId: input.params.organizationId } }
  }
}

@Module({
  imports: [UsersModule, AuthModule, RbacModule, ContextModule],
  controllers: [SchemaRouteTestController],
})
class SchemaRouteTestModule {}

describe("SchemaRoute", () => {
  let app: INestApplication<App>
  let request: Requester
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>
  let repositories: AllRepositories

  let accessToken: string | undefined = "token"
  let authSubject = `oidc|${randomUUID()}`

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({
      additionalImports: [SchemaRouteTestModule],
      applyOverrides: (moduleBuilder) => setupUserGuardForTesting(moduleBuilder, () => authSubject),
    })
    await ensureRbacCatalog(setup.module)
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    await app.init()
    request = testRequester(app)
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    accessToken = "token"
    authSubject = `oidc|${randomUUID()}`
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const getItem = (itemId: string, query: Record<string, string>) =>
    request({ route: TestRoutes.getItem, pathParams: { itemId }, query, token: accessToken })

  it("applies the guard chain: a request without a token answers 401", async () => {
    accessToken = undefined
    const response = await getItem(randomUUID(), { page: "0" })
    expectResponse(response, 401, AUTH_ERRORS.NO_ACCESS_TOKEN)
  })

  it("hands the parsed params and query to the handler and strips undeclared response keys", async () => {
    const itemId = randomUUID()
    const response = await getItem(itemId, { page: "2" })
    expectResponse(response, 200)
    expect(response.body).toEqual({ data: { itemId, page: 2 } })
  })

  it("answers 400 with the issues for a malformed path param", async () => {
    const response = await getItem("not-a-uuid", { page: "0" })
    expectResponse(response, 400)
    expect(errorOutputSchema.parse(response.body)).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
      issues: [{ path: ["params", "itemId"], code: "invalid_format" }],
    })
  })

  it("answers 400 for a missing or unknown query value", async () => {
    const missing = await getItem(randomUUID(), {})
    expectResponse(missing, 400)
    expect(readIssues(missing.body)).toMatchObject([{ path: ["query", "page"] }])

    const unknown = await getItem(randomUUID(), { page: "0", sort: "name" })
    expectResponse(unknown, 400)
    expect(readIssues(unknown.body)).toMatchObject([{ path: ["query"], code: "unrecognized_keys" }])
  })

  it("answers 400 when a body reaches a route that reads none", async () => {
    const response = await supertest(app.getHttpServer())
      .get(TestRoutes.getItem.getPath({ itemId: randomUUID() }))
      .query({ page: "0" })
      .set("Authorization", "Bearer token")
      .send({ payload: { title: "Unexpected" } })
    expectResponse(response, 400)
    expect(readIssues(response.body)).toMatchObject([{ path: ["body"], code: "unrecognized_keys" }])
  })

  it("reads the payload of a body and refuses unknown keys in it", async () => {
    const created = await request({
      route: TestRoutes.createItem,
      request: { payload: { title: "Weekly report" } },
      token: accessToken,
    })
    expectResponse(created, 201)
    expect(created.body).toEqual({ data: { title: "Weekly report" } })

    const refused = await supertest(app.getHttpServer())
      .post(TestRoutes.createItem.path)
      .set("Authorization", "Bearer token")
      .send({ payload: { title: "Weekly report", color: "red" } })
    expectResponse(refused, 400)
    expect(readIssues(refused.body)).toMatchObject([{ path: ["body"], code: "unrecognized_keys" }])

    const empty = await supertest(app.getHttpServer())
      .post(TestRoutes.createItem.path)
      .set("Authorization", "Bearer token")
    expectResponse(empty, 400)
    expect(readIssues(empty.body)).toMatchObject([{ path: ["body"] }])
  })

  it("logs the issue paths and answers 500 when a response breaks its contract", async () => {
    const logError = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined)
    const response = await request({ route: TestRoutes.getBroken, token: accessToken })
    expectResponse(response, 500)
    expect(logError).toHaveBeenCalledWith("A response does not match the schema of its route", {
      route: "GET /schema-route-test/broken",
      issues: [{ path: "data.count", code: "invalid_type" }],
    })
    logError.mockRestore()
  })

  describe("with a resource in the path", () => {
    const getOrganization = (organizationId: string) =>
      request({
        route: TestRoutes.getOrganization,
        pathParams: { organizationId },
        token: accessToken,
      })

    it("parses the params before any resolver runs", async () => {
      const response = await getOrganization("not-a-uuid")
      expectResponse(response, 400)
      expect(readIssues(response.body)).toMatchObject([{ path: ["params", "organizationId"] }])
    })

    it("resolves the resource the path names and checks the permission on it", async () => {
      const ownerAuthSubject = `oidc|${randomUUID()}`
      const { organization } = await createOrganizationWithOwner(repositories, {
        user: { authSubject: ownerAuthSubject, email: mockOidcEmailForSub(ownerAuthSubject) },
      })

      authSubject = ownerAuthSubject
      const allowed = await getOrganization(organization.id)
      expectResponse(allowed, 200)
      expect(allowed.body).toEqual({ data: { organizationId: organization.id } })

      authSubject = mockForeignAuthSubject()
      const refused = await getOrganization(organization.id)
      expectResponse(refused, 401, AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    })
  })
})
