import "./external/llm/open-telemetry-init" // must be first — patches http/pg before they are imported
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ValidationPipe } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS
import { NestExpressApplication } from "@nestjs/platform-express"
import { AppModule } from "./app.module"
import { registerBullBoardOpenIdConnect } from "./common/bull-board/bull-board-openid-registration"
import { StackTraceLoggingExceptionFilter } from "./common/filters/stack-trace-logging-exception.filter"
import { getLogLevels, StructuredLogger } from "./common/logger/structured-logger"
import { enableDbListeners } from "./common/sse/postgres-status-stream.service"

const isProduction = process.env.NODE_ENV === "production"

async function bootstrap() {
  enableDbListeners()
  const _frontendUrls = parseFrontendUrls(process.env.FRONTEND_URL)
  const httpsOptions = loadHttpsCertificates()
  const logLevels = getLogLevels()
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: isProduction ? new StructuredLogger(logLevels) : logLevels,
    ...(httpsOptions && { httpsOptions }),
  })
  if (isProduction) {
    // Behind Cloud Run/reverse proxies, trust X-Forwarded-* so OIDC/cookies see HTTPS correctly.
    app.set("trust proxy", true)
  }
  registerBullBoardOpenIdConnect(app)
  app.useBodyParser("json", { limit: "500kb" })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  app.useGlobalFilters(new StackTraceLoggingExceptionFilter(app.getHttpAdapter()))
  // CORS strategy:
  // - Authenticated endpoints are secured by JWT — the real security layer.
  //   No cookies are used (Auth0 Bearer tokens), so reflecting back the request
  //   origin is safe: a cross-origin attacker cannot inject the Bearer token.
  // - Public embed endpoints (/public/*) are designed to be called from arbitrary
  //   host pages. Their security is enforced by EmbedTokenGuard (embed token +
  //   per-config allowedOrigins check), not by CORS.
  // Reflecting the origin (instead of using '*') is required because the embed
  // widget's fetch calls don't use `credentials: 'include'`, but some browsers
  // are stricter with '*' when custom headers (X-Session-Token) are present.
  app.enableCors({
    origin: (origin, callback) => callback(null, origin ?? true),
    credentials: true,
  })
  const port = Number(process.env.PORT) || 3000
  await app.listen(port)
}

const DEFAULT_LOCAL_FRONTEND_URLS = [
  // `vite dev` and `vite preview` — see apps/web/vite.config.ts.
  "https://connect.localhost:5173",
  "https://connect.localhost:5174",
]

/**
 * Parses `FRONTEND_URL` into a list of CORS origins. Accepts a single URL or
 * a comma-separated list. Each entry is trimmed and normalized to https://
 * if no scheme is given. When the env var is unset and we're not in
 * production, falls back to the local dev/preview URLs so a fresh checkout
 * works without extra `.env` setup. In production, an unset env var yields
 * an empty array (no origins allowed).
 */
function parseFrontendUrls(frontendUrl: string | undefined): string[] {
  if (!frontendUrl) {
    return isProduction ? [] : DEFAULT_LOCAL_FRONTEND_URLS
  }
  return frontendUrl
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) =>
      url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`,
    )
}

/**
 * Loads HTTPS certificates from the .certs directory if they exist.
 * Returns undefined if certificates are not found (falls back to HTTP).
 */
function loadHttpsCertificates(): { key: Buffer; cert: Buffer } | undefined {
  try {
    const certsDir = join(__dirname, "..", ".certs")
    return {
      key: readFileSync(join(certsDir, "key.pem")),
      cert: readFileSync(join(certsDir, "cert.pem")),
    }
  } catch {
    return undefined
  }
}

void bootstrap()
