import "./external/llm/open-telemetry-init" // must be first — patches http/pg before they are imported
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { type INestApplication, Logger, ValidationPipe } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS
import { NestExpressApplication } from "@nestjs/platform-express"
import { AppModule } from "./app.module"
import { registerBullBoardOpenIdConnect } from "./common/bull-board/bull-board-openid-registration"
import { StackTraceLoggingExceptionFilter } from "./common/filters/stack-trace-logging-exception.filter"
import { getLogLevels, StructuredLogger } from "./common/logger/structured-logger"
import { enableDbListeners } from "./common/sse/postgres-status-stream.service"
import { registerWebApp } from "./common/web-app/web-app.middleware"
import { configureGlobalPrefix } from "./config/api-prefix"
import { buildCorsOptionsDelegate, parseFrontendUrls } from "./config/cors"
import { BuiltInMcpServersService } from "./domains/mcp-servers/built-in/built-in-mcp-servers.service"

const isProduction = process.env.NODE_ENV === "production"
const logger = new Logger("Bootstrap")
// Below the termination grace of the Helm chart (30 s). Cloud Run gives 10 s:
// set API_SHUTDOWN_TIMEOUT_MS lower there.
const DEFAULT_API_SHUTDOWN_TIMEOUT_MS = 25_000

function getApiShutdownTimeoutMs(): number {
  const timeoutValue = process.env.API_SHUTDOWN_TIMEOUT_MS
  if (!timeoutValue) {
    return DEFAULT_API_SHUTDOWN_TIMEOUT_MS
  }
  const parsedTimeout = Number.parseInt(timeoutValue, 10)
  return Number.isNaN(parsedTimeout) || parsedTimeout < 0
    ? DEFAULT_API_SHUTDOWN_TIMEOUT_MS
    : parsedTimeout
}

/**
 * On SIGTERM (a rollout, a scale down), stop accepting connections and let the
 * requests in flight finish: app.close() closes the HTTP server, then runs the
 * shutdown hooks (database pool, queues). Streams (SSE) hold the server open,
 * so the wait is bounded: past the timeout the process exits and the clients
 * reconnect.
 */
function registerGracefulShutdown(app: INestApplication, timeoutMs: number): void {
  let shuttingDown = false
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    logger.log(`${signal} received: closing, waiting up to ${timeoutMs} ms for requests in flight`)
    const deadline = setTimeout(() => {
      logger.warn(`Connections still open after ${timeoutMs} ms, exiting`)
      process.exit(0)
    }, timeoutMs)
    deadline.unref()
    try {
      await app.close()
      logger.log("Closed, exiting")
      process.exit(0)
    } catch (error) {
      logger.error("Error while closing", error instanceof Error ? error.stack : String(error))
      process.exit(1)
    }
  }
  process.once("SIGTERM", () => void shutdown("SIGTERM"))
  process.once("SIGINT", () => void shutdown("SIGINT"))
}

async function bootstrap() {
  enableDbListeners()
  const frontendUrls = parseFrontendUrls(process.env.FRONTEND_URL, isProduction)
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
  // Private API under /api, public chat API at /public (see config/api-prefix).
  configureGlobalPrefix(app)
  registerBullBoardOpenIdConnect(app)
  // Web front served at / from this process in the app-runtime image (no-op otherwise).
  registerWebApp(app)
  app.useBodyParser("json", { limit: "500kb" })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  app.useGlobalFilters(new StackTraceLoggingExceptionFilter(app.getHttpAdapter()))
  // Two CORS policies, split by path — see buildCorsOptionsDelegate (#366).
  app.enableCors(buildCorsOptionsDelegate(frontendUrls))
  // Platform-provided MCP servers are rows in mcp_server, kept in sync with
  // the environment here rather than by a migration or a lifecycle hook (which
  // would also run in the workers and in tests).
  try {
    await app.get(BuiltInMcpServersService).syncFromEnvironment()
  } catch (error) {
    // The built-in servers are an optional add-on: failing to sync them must
    // not stop the API from serving every other route.
    logger.error(
      `Could not sync the built-in MCP servers: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
    )
  }
  registerGracefulShutdown(app, getApiShutdownTimeoutMs())
  const port = Number(process.env.PORT) || 3000
  await app.listen(port)
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
