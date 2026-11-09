import { Controller, Get } from "@nestjs/common"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { configureGlobalPrefix } from "@/config/api-prefix"
import { readAppVersion, registerAppVersionHeader } from "./app-version-header"

@Controller("ping")
class PrivatePingController {
  @Get()
  ping(): { pong: true } {
    return { pong: true }
  }
}

@Controller("public/ping")
class PublicPingController {
  @Get()
  ping(): { publicPong: true } {
    return { publicPong: true }
  }
}

async function createApp(version: string | undefined): Promise<NestExpressApplication> {
  const module = await Test.createTestingModule({
    controllers: [PrivatePingController, PublicPingController],
  }).compile()
  const app = module.createNestApplication<NestExpressApplication>()
  configureGlobalPrefix(app)
  registerAppVersionHeader(app, version)
  await app.init()
  return app
}

describe("registerAppVersionHeader", () => {
  let app: NestExpressApplication

  afterEach(async () => {
    await app.close()
  })

  it("names the release on every response of the private API", async () => {
    app = await createApp("26.11.1")
    const response = await request(app.getHttpServer()).get("/api/ping")
    expect(response.status).toBe(200)
    expect(response.headers["x-app-version"]).toBe("26.11.1")
  })

  it("names it on an error response too", async () => {
    app = await createApp("26.11.1")
    const response = await request(app.getHttpServer()).get("/api/unknown")
    expect(response.status).toBe(404)
    expect(response.headers["x-app-version"]).toBe("26.11.1")
  })

  it("leaves the public API's headers as they are", async () => {
    app = await createApp("26.11.1")
    const response = await request(app.getHttpServer()).get("/public/ping")
    expect(response.status).toBe(200)
    expect(response.headers["x-app-version"]).toBeUndefined()
  })

  it("adds nothing when the process knows no version", async () => {
    app = await createApp(undefined)
    const response = await request(app.getHttpServer()).get("/api/ping")
    expect(response.headers["x-app-version"]).toBeUndefined()
  })
})

describe("readAppVersion", () => {
  it("reads the image tag first, then the commit", () => {
    expect(readAppVersion({ APP_VERSION: " 26.11.1 ", GIT_SHA: "abc1234" })).toBe("26.11.1")
    expect(readAppVersion({ GIT_SHA: "abc1234" })).toBe("abc1234")
    expect(readAppVersion({ APP_VERSION: " " })).toBeUndefined()
  })
})
