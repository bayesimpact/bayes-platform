import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { registerWebAppStaticAssets, WebAppModule } from "./web-app.module"
import { getWebAppSettings } from "./web-app-config"

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

async function createApp(distDir: string): Promise<NestExpressApplication> {
  const settings = getWebAppSettings({ WEB_APP_DIST_DIR: distDir })
  const module = await Test.createTestingModule({
    imports: [WebAppModule.register(settings)],
  }).compile()
  const app = module.createNestApplication<NestExpressApplication>()
  registerWebAppStaticAssets(app, settings)
  await app.init()
  return app
}

describe("WebAppController", () => {
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

  it("serves the entry page with the injected configuration under /app", async () => {
    const response = await request(app.getHttpServer()).get("/app")
    expect(response.status).toBe(200)
    expect(response.headers["content-type"]).toMatch(/text\/html/)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.headers["permissions-policy"]).toBe("microphone=(self)")
    expect(response.text).toContain('"auth0ClientId":"spa-client"')
    expect(response.text).toContain("<title>Acme Platform</title>")
  })

  it("serves the entry page for every client route", async () => {
    const response = await request(app.getHttpServer()).get("/app/studio/agents/42/settings")
    expect(response.status).toBe(200)
    expect(response.text).toContain("window.__CONFIG__")
  })

  it("serves hashed assets as immutable", async () => {
    const response = await request(app.getHttpServer()).get("/app/assets/index-abc123.js")
    expect(response.status).toBe(200)
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable")
    expect(response.text).toBe("console.log(1)")
  })

  it("serves theme files with a short cache", async () => {
    const response = await request(app.getHttpServer()).get("/app/theme/logo.svg")
    expect(response.status).toBe(200)
    expect(response.headers["cache-control"]).toBe("public, max-age=300")
  })

  it("redirects the root to the SPA", async () => {
    const response = await request(app.getHttpServer()).get("/")
    expect(response.status).toBe(302)
    expect(response.headers.location).toBe("/app/")
  })
})

describe("WebAppModule without WEB_APP_DIST_DIR", () => {
  it("registers no route", async () => {
    const module = await Test.createTestingModule({
      imports: [WebAppModule.register(null)],
    }).compile()
    const app = module.createNestApplication<NestExpressApplication>()
    registerWebAppStaticAssets(app, null)
    await app.init()
    expect((await request(app.getHttpServer()).get("/app")).status).toBe(404)
    expect((await request(app.getHttpServer()).get("/")).status).toBe(404)
    await app.close()
  })
})
