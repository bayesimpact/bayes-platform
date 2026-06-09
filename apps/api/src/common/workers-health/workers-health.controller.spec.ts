import { getQueueToken } from "@nestjs/bullmq"
import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { getDataSourceToken } from "@nestjs/typeorm"
import request from "supertest"
import type { App } from "supertest/types"
import { WORKERS_HEALTH_QUEUE_NAME } from "./workers-health.constants"
import { WorkersHealthController } from "./workers-health.controller"

describe("WorkersHealthController", () => {
  let app: INestApplication<App>
  const queryMock = jest.fn()
  const pingMock = jest.fn()
  const dataSource = { query: queryMock }
  const redisClient = { ping: pingMock }
  const queue = { client: Promise.resolve(redisClient) }

  beforeEach(async () => {
    queryMock.mockReset()
    pingMock.mockReset()
    const module = await Test.createTestingModule({
      controllers: [WorkersHealthController],
      providers: [
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getQueueToken(WORKERS_HEALTH_QUEUE_NAME), useValue: queue },
      ],
    }).compile()
    app = module.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it("returns 200 when postgres and redis are healthy", async () => {
    queryMock.mockResolvedValue([{ "?column?": 1 }])
    pingMock.mockResolvedValue("PONG")
    const response = await request(app.getHttpServer()).get("/healthz")
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ postgres: { ok: true }, redis: { ok: true } })
  })

  it("returns 503 when postgres fails", async () => {
    queryMock.mockRejectedValue(new Error("connection refused"))
    pingMock.mockResolvedValue("PONG")
    const response = await request(app.getHttpServer()).get("/healthz")
    expect(response.status).toBe(503)
    expect(response.body.postgres).toEqual({ ok: false, error: "connection refused" })
    expect(response.body.redis).toEqual({ ok: true })
  })

  it("returns 503 when redis fails", async () => {
    queryMock.mockResolvedValue([{ "?column?": 1 }])
    pingMock.mockRejectedValue(new Error("redis timeout"))
    const response = await request(app.getHttpServer()).get("/healthz")
    expect(response.status).toBe(503)
    expect(response.body.redis).toEqual({ ok: false, error: "redis timeout" })
    expect(response.body.postgres).toEqual({ ok: true })
  })

  it("returns 503 when redis ping returns unexpected value", async () => {
    queryMock.mockResolvedValue([{ "?column?": 1 }])
    pingMock.mockResolvedValue("NOPE")
    const response = await request(app.getHttpServer()).get("/healthz")
    expect(response.status).toBe(503)
    expect(response.body.redis).toEqual({ ok: false, error: "Unexpected ping response: NOPE" })
  })
})
