import "./external/llm/open-telemetry-init" // must be first — patches http/pg before they are imported
import { type INestApplication, Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { getLogLevels, StructuredLogger } from "@/common/logger/structured-logger"
import {
  getDoclingTimeoutMs,
  getDoclingVersion,
  getDocumentChunkerCommand,
  isDoclingEnabled,
} from "@/external/docling/docling.cli"
import { runDoclingSelfTestIfEnabled } from "@/external/docling/docling.self-test"
import { WorkersAppModule } from "./workers-app.module"

const DEFAULT_WORKER_DOCLING_HEALTH_CHECK_TIMEOUT_MS = 30_000
const DEFAULT_WORKER_HEALTH_PORT = 8080
// Below the 120 s the Helm chart gives a workers pod to terminate. Cloud Run
// gives 10 s: set WORKER_SHUTDOWN_TIMEOUT_MS lower there.
const DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS = 100_000

function getWorkerDoclingHealthCheckTimeoutMs(): number {
  const timeoutValue = process.env.WORKER_DOCLING_HEALTH_CHECK_TIMEOUT_MS
  if (!timeoutValue) {
    return DEFAULT_WORKER_DOCLING_HEALTH_CHECK_TIMEOUT_MS
  }

  const parsedTimeout = Number.parseInt(timeoutValue, 10)
  return Number.isNaN(parsedTimeout)
    ? DEFAULT_WORKER_DOCLING_HEALTH_CHECK_TIMEOUT_MS
    : parsedTimeout
}

function getWorkerShutdownTimeoutMs(): number {
  const timeoutValue = process.env.WORKER_SHUTDOWN_TIMEOUT_MS
  if (!timeoutValue) {
    return DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS
  }

  const parsedTimeout = Number.parseInt(timeoutValue, 10)
  return Number.isNaN(parsedTimeout) || parsedTimeout < 0
    ? DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS
    : parsedTimeout
}

/**
 * On SIGTERM (a rollout, a scale down), stop taking jobs and let the jobs in
 * progress finish: app.close() runs the shutdown hooks, and the BullMQ module
 * closes every worker, which waits for its active jobs. The wait is bounded:
 * past the timeout the process exits and BullMQ hands the unfinished jobs
 * back to the queue once their lock expires (maxStalledCount on the workers).
 */
function registerGracefulShutdown(app: INestApplication, timeoutMs: number): void {
  let shuttingDown = false
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    Logger.log(
      `${signal} received: no new jobs, waiting up to ${timeoutMs} ms for the jobs in progress`,
      "WorkersMain",
    )
    const deadline = setTimeout(() => {
      Logger.warn(
        `Jobs still in progress after ${timeoutMs} ms, exiting; they go back to the queue`,
        "WorkersMain",
      )
      process.exit(0)
    }, timeoutMs)
    deadline.unref()
    try {
      await app.close()
      Logger.log("Workers closed, exiting", "WorkersMain")
      process.exit(0)
    } catch (error) {
      Logger.error(
        "Error while closing the workers",
        error instanceof Error ? error.stack : String(error),
        "WorkersMain",
      )
      process.exit(1)
    }
  }
  process.once("SIGTERM", () => void shutdown("SIGTERM"))
  process.once("SIGINT", () => void shutdown("SIGINT"))
}

function getWorkerHealthPort(): number {
  const portValue = process.env.WORKER_HEALTH_PORT ?? process.env.PORT
  if (!portValue) {
    return DEFAULT_WORKER_HEALTH_PORT
  }

  const parsedPort = Number.parseInt(portValue, 10)
  return Number.isNaN(parsedPort) ? DEFAULT_WORKER_HEALTH_PORT : parsedPort
}

async function bootstrapWorkersMain() {
  const healthCheckTimeoutMs = getWorkerDoclingHealthCheckTimeoutMs()
  await ensureDoclingIsReadyForWorkers(healthCheckTimeoutMs)
  await runDoclingSelfTestIfEnabled(healthCheckTimeoutMs)
  const isProduction = process.env.NODE_ENV === "production"
  const logLevels = getLogLevels()
  const app = await NestFactory.create(WorkersAppModule, {
    logger: isProduction ? new StructuredLogger(logLevels) : logLevels,
  })
  registerGracefulShutdown(app, getWorkerShutdownTimeoutMs())
  const port = getWorkerHealthPort()
  await app.listen(port)
  Logger.log(`Workers app started, health endpoint listening on :${port}/healthz`, "WorkersMain")
}

async function ensureDoclingIsReadyForWorkers(timeoutMs: number): Promise<void> {
  if (!isDoclingEnabled()) {
    Logger.log(
      "Docling check skipped because DOCUMENT_EXTRACTOR_DOCLING_ENABLED=false",
      "WorkersMain",
    )
    return
  }

  try {
    const version = await getDoclingVersion({
      timeoutMs: getDoclingTimeoutMs(timeoutMs),
    })
    Logger.log(`Docling health check passed (${version || "version unavailable"})`, "WorkersMain")
  } catch (error) {
    Logger.error(
      `Docling health check failed. Command "${getDocumentChunkerCommand()} --docling-version" is not available or timed out.`,
      error instanceof Error ? error.stack : String(error),
      "WorkersMain",
    )
    throw error
  }
}

void bootstrapWorkersMain()
