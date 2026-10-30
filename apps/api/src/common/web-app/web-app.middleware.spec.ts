import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Controller, Get } from "@nestjs/common"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { configureGlobalPrefix } from "@/config/api-prefix"
import { registerWebApp } from "./web-app.middleware"
import { getDeskAppSettings, getWebAppSettings } from "./web-app-config"

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

function buildDeskDist(): string {
  const distDir = mkdtempSync(join(tmpdir(), "desk-app-dist-"))
  mkdirSync(join(distDir, "assets"))
  mkdirSync(join(distDir, "theme"))
  writeFileSync(
    join(distDir, "index.html"),
    "<html><head><title>Desk</title></head><body>desk entry</body></html>",
  )
  writeFileSync(join(distDir, "assets", "index-def456.js"), "console.log(2)")
  writeFileSync(join(distDir, "theme", "theme.css"), ":root {}")
  return distDir
}

async function createApp(
  distDir: string | null,
  deskDistDir: string | null = null,
): Promise<NestExpressApplication> {
  const settings = distDir ? getWebAppSettings({ WEB_APP_DIST_DIR: distDir }) : null
  const deskSettings = deskDistDir ? getDeskAppSettings({ DESK_APP_DIST_DIR: deskDistDir }) : null
  const module = await Test.createTestingModule({
    controllers: [PrivatePingController, PublicPingController],
  }).compile()
  const app = module.createNestApplication<NestExpressApplication>()
  configureGlobalPrefix(app)
  registerWebApp(app, settings, deskSettings)
  await app.init()
  return app
}

describe("registerWebApp", () => {
  const previousEnv = { ...process.env }
  let app: NestExpressApplication

  beforeAll(async () => {
    process.env.WEB_APP_TITLE = "Acme Platform"
    process.env.WEB_OIDC_CLIENT_ID = "spa-client"
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
    expect(response.text).toContain('"oidcClientId":"spa-client"')
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

  it("forbids framing the OAuth consent page, and only that page", async () => {
    const consent = await request(app.getHttpServer())
      .get("/oauth/authorize?client_id=x")
      .accept("text/html")
    const studio = await request(app.getHttpServer()).get("/studio").accept("text/html")

    expect(consent.headers["x-frame-options"]).toBe("DENY")
    expect(consent.headers["content-security-policy"]).toBe("frame-ancestors 'none'")
    expect(studio.headers["x-frame-options"]).toBeUndefined()
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

  it("leaves the well-known documents to Nest, whatever the client accepts", async () => {
    for (const accept of ["*/*", "text/html"]) {
      const response = await request(app.getHttpServer())
        .get("/.well-known/oauth-authorization-server/api/oauth")
        .accept(accept)
      expect(response.text).not.toContain("window.__CONFIG__")
      expect(response.status).toBe(404)
    }
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

describe("registerWebApp with the Desk", () => {
  const previousEnv = { ...process.env }
  let app: NestExpressApplication

  beforeAll(async () => {
    process.env.WEB_OIDC_CLIENT_ID = "spa-client"
    process.env.WEB_HELP_CENTER_URL = "https://help.example.org"
    app = await createApp(buildDist(), buildDeskDist())
  })

  afterAll(async () => {
    process.env = previousEnv
    await app.close()
  })

  it("serves the Desk's entry page, with the injected configuration, for its pages", async () => {
    for (const path of ["/app/", "/app/o/1/p/2/a/3/as/4"]) {
      const response = await request(app.getHttpServer()).get(path).accept("text/html")
      expect(response.status).toBe(200)
      expect(response.text).toContain("desk entry")
      expect(response.text).toContain('"oidcClientId":"spa-client"')
      expect(response.text).toContain('"helpCenterUrl":"https://help.example.org"')
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(response.headers["permissions-policy"]).toBe("microphone=(self)")
    }
  })

  it("redirects /app to the Desk's base, with its query", async () => {
    const response = await request(app.getHttpServer()).get("/app?login_hint=a").accept("text/html")
    expect(response.status).toBe(301)
    expect(response.headers.location).toBe("/app/?login_hint=a")
  })

  it("serves the Desk's files, its hashed assets as immutable", async () => {
    const asset = await request(app.getHttpServer()).get("/app/assets/index-def456.js")
    expect(asset.status).toBe(200)
    expect(asset.headers["cache-control"]).toBe("public, max-age=31536000, immutable")
    const theme = await request(app.getHttpServer()).get("/app/theme/theme.css")
    expect(theme.status).toBe(200)
    expect(theme.headers["cache-control"]).toBe("public, max-age=300")
  })

  it("answers a missing asset with a 404, never with an entry page", async () => {
    const response = await request(app.getHttpServer())
      .get("/app/assets/old-chunk.js")
      .accept("*/*")
    expect(response.status).toBe(404)
    expect(response.text).not.toContain("entry")
  })

  it("keeps the web front everywhere else", async () => {
    const response = await request(app.getHttpServer()).get("/application").accept("text/html")
    expect(response.text).toContain("<title>AgentStudio</title>")
    expect((await request(app.getHttpServer()).get("/assets/index-abc123.js")).status).toBe(200)
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
