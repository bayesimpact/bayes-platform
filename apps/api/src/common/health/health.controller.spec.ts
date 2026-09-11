import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { getDataSourceToken } from "@nestjs/typeorm"
import request from "supertest"
import type { App } from "supertest/types"
import { configureGlobalPrefix } from "@/config/api-prefix"
import { HealthController } from "./health.controller"

describe("HealthController", () => {
  let app: INestApplication<App>
  const queryMock = jest.fn()

  beforeEach(async () => {
    queryMock.mockReset()
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: getDataSourceToken(), useValue: { query: queryMock } }],
    }).compile()
    app = module.createNestApplication()
    configureGlobalPrefix(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it("answers under the private API prefix", async () => {
    queryMock.mockResolvedValue([{ "?column?": 1 }])
    const response = await request(app.getHttpServer()).get("/api/healthz")
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ postgres: { ok: true } })
    expect((await request(app.getHttpServer()).get("/healthz")).status).toBe(404)
  })

  it("returns 503 when Postgres is unreachable", async () => {
    queryMock.mockRejectedValue(new Error("connection refused"))
    const response = await request(app.getHttpServer()).get("/api/healthz")
    expect(response.status).toBe(503)
    expect(response.body).toEqual({ postgres: { ok: false, error: "connection refused" } })
  })
})
