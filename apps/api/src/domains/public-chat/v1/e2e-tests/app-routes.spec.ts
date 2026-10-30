import { PublicChatRoutes, type PublicStreamEventPayload } from "@caseai-connect/api-contracts"
import { afterAll } from "@jest/globals"
import {
  type DynamicModule,
  type INestApplication,
  type Type,
  ValidationPipe,
} from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import request from "supertest"
import type { App } from "supertest/types"
import { AppModule } from "@/app.module"
import { parseSseDataEvents } from "@/common/test/sse.helpers"
import {
  type AllRepositories,
  clearTestDatabase,
  setupE2eTestDatabase,
  teardownE2eTestDatabase,
} from "@/common/test/test-database"
import { TransactionModule } from "@/common/transaction/transaction.module"
import { configureGlobalPrefix } from "@/config/api-prefix"
import { createEmbedConfigWithSession } from "../../public-chat.factory"

/**
 * AppModule's imports in its order, read from its metadata so this list never drifts. The
 * test setup brings its own config, database and transaction modules in place of these.
 */
function appModuleImports(): Array<Type<unknown> | DynamicModule> {
  const imports: Array<Type<unknown> | DynamicModule> = Reflect.getMetadata("imports", AppModule)
  const replacedBySetup: unknown[] = [ConfigModule, TypeOrmModule, TransactionModule]
  return imports.filter((imported) => {
    const moduleClass = "module" in imported ? imported.module : imported
    return !replacedBySetup.includes(moduleClass)
  })
}

/**
 * The public routes as the API serves them: every module in AppModule's order, the global
 * prefix and the validation pipe of `main.ts`. A route registered earlier can catch a later
 * one with the same method (a `POST .../:id` catches `POST .../stream`), which a test that
 * loads one module never sees.
 */
describe("PublicChat - routes in AppModule's order", () => {
  let app: INestApplication<App>
  let repositories: AllRepositories
  let setup: Awaited<ReturnType<typeof setupE2eTestDatabase>>

  let embedToken: string
  let sessionId: string
  let sessionToken: string

  beforeAll(async () => {
    setup = await setupE2eTestDatabase({ additionalImports: appModuleImports() })
    repositories = setup.getAllRepositories()
    app = setup.module.createNestApplication()
    configureGlobalPrefix(app)
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    )
    await app.init()
  })

  beforeEach(async () => {
    await clearTestDatabase(setup.dataSource)
    const context = await createEmbedConfigWithSession(repositories)
    embedToken = context.embedConfig.embedToken
    sessionId = context.session.id
    sessionToken = context.sessionToken
  })

  afterAll(async () => {
    await teardownE2eTestDatabase(setup)
    await app.close()
  })

  const pathParams = () => ({ embedToken, sessionId })

  it("reaches the POST stream with the message in the body", async () => {
    // An empty message proves the stream handler answered: only it frames an error as an event.
    const response = await request(app.getHttpServer())
      .post(PublicChatRoutes.streamReply.getPath(pathParams()))
      .send({ payload: { content: " " } })
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)

    expect(response.status).toBe(200)
    expect(response.headers["content-type"]).toMatch(/^text\/event-stream/)
    expect(parseSseDataEvents<PublicStreamEventPayload>(response.text)).toEqual([
      { type: "error", messageId: "", error: "User content must not be empty" },
    ])
  })

  it("serves no GET stream with the message in the URL", async () => {
    const response = await request(app.getHttpServer())
      .get(`/public/v1/agents/${embedToken}/sessions/${sessionId}/messages/stream`)
      .query({ q: JSON.stringify({ payload: { content: "Hello" } }) })
      .set("Connection", "close")
      .set("X-Session-Token", sessionToken)

    expect(response.status).toBe(404)
  })

  it("still creates a session on the other public POST route", async () => {
    const response = await request(app.getHttpServer())
      .post(PublicChatRoutes.createSession.getPath({ embedToken }))
      .send({ payload: {} })
      .set("Connection", "close")

    expect(response.status).toBe(201)
    expect(response.body.data.sessionId).toEqual(expect.any(String))
  })
})
