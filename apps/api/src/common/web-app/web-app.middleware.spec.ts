import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Controller, Get } from "@nestjs/common"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { configureGlobalPrefix } from "@/config/api-prefix"
import { registerWebApp } from "./web-app.middleware"
import { getWebAppSettings } from "./web-app-config"

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

function buildDist(): string {
  const distDir = mkdtempSync(join(tmpdir(), "web-app-dist-"))
  mkdirSync(join(distDir, "assets"))
  mkdirSync(join(distDir, "theme"))
  writeFileSync(
    join(distDir, "index.html"),
    "<html><head><title>AgentStudio</title></head><body></body></html>",
  )
  writeFileSync(join(distDir, "assets", "index-abc123.js"), "console.log(1)")
  writeFileSync(join(distDir, "theme", "logo.svg"), "<svg></svg>")
  return distDir
}

async function createApp(distDir: string | null): Promise<NestExpressApplication> {
  const settings = distDir ? getWebAppSettings({ WEB_APP_DIST_DIR: distDir }) : null
  const module = await Test.createTestingModule({
    controllers: [PrivatePingController, PublicPingController],
  }).compile()
  const app = module.createNestApplication<NestExpressApplication>()
  configureGlobalPrefix(app)
  registerWebApp(app, settings)
  await app.init()
  return app
}

describe("registerWebApp", () => {
  const previousEnv = { ...process.env }
  let app: NestExpressApplication

  beforeAll(async () => {
    process.env.WEB_APP_TITLE = "Acme Platform"
    process.env.WEB_AUTH0_CLIENT_ID = "spa-client"
    app = await createApp(buildDist())
  })

  afterAll(async () => {
    process.env = previousEnv
    await app.close()
  })

  it("serves the entry page with the injected configuration at /", async () => {
    const response = await request(app.getHttpServer()).get("/").accept("text/html")
    expect(response.status).toBe(200)
    expect(response.headers["content-type"]).toMatch(/text\/html/)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.headers["permissions-policy"]).toBe("microphone=(self)")
    expect(response.text).toContain('"auth0ClientId":"spa-client"')
    expect(response.text).toContain('"apiUrl":"/api"')
    expect(response.text).toContain("<title>Acme Platform</title>")
  })

  it("serves the entry page for every client route", async () => {
    const response = await request(app.getHttpServer())
      .get("/studio/agents/42/settings")
      .accept("text/html")
    expect(response.status).toBe(200)
    expect(response.text).toContain("window.__CONFIG__")
  })

  it("serves hashed assets as immutable", async () => {
    const response = await request(app.getHttpServer()).get("/assets/index-abc123.js")
    expect(response.status).toBe(200)
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable")
    expect(response.text).toBe("console.log(1)")
  })

  it("serves theme files with a short cache", async () => {
    const response = await request(app.getHttpServer()).get("/theme/logo.svg")
    expect(response.status).toBe(200)
    expect(response.headers["cache-control"]).toBe("public, max-age=300")
  })

  it("leaves the private API under /api to Nest", async () => {
    const served = await request(app.getHttpServer()).get("/api/ping").accept("text/html")
    expect(served.status).toBe(200)
    expect(served.body).toEqual({ pong: true })
    const unknown = await request(app.getHttpServer()).get("/api/nope").accept("text/html")
    expect(unknown.status).toBe(404)
    expect(unknown.headers["content-type"]).toMatch(/application\/json/)
  })

  it("leaves the public API under /public to Nest, without the prefix", async () => {
    const served = await request(app.getHttpServer()).get("/public/ping").accept("text/html")
    expect(served.status).toBe(200)
    expect(served.body).toEqual({ publicPong: true })
    expect((await request(app.getHttpServer()).get("/api/public/ping")).status).toBe(404)
    const unknown = await request(app.getHttpServer()).get("/public/nope").accept("text/html")
    expect(unknown.status).toBe(404)
  })

  it("does not answer a private route at the root", async () => {
    const response = await request(app.getHttpServer()).get("/ping").accept("application/json")
    expect(response.status).toBe(404)
  })

  it("never answers a non-navigation request with the entry page", async () => {
    expect((await request(app.getHttpServer()).post("/studio").send({})).status).toBe(404)
    const json = await request(app.getHttpServer()).get("/studio").accept("application/json")
    expect(json.status).toBe(404)
  })
})

describe("registerWebApp without WEB_APP_DIST_DIR", () => {
  it("registers no route", async () => {
    const app = await createApp(null)
    expect((await request(app.getHttpServer()).get("/").accept("text/html")).status).toBe(404)
    expect((await request(app.getHttpServer()).get("/studio")).status).toBe(404)
    expect((await request(app.getHttpServer()).get("/api/ping")).status).toBe(200)
    await app.close()
  })
})
