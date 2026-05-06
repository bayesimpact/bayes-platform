import "./external/llm/open-telemetry-init" // must be first — patches http/pg before they are imported
import { Logger } from "@nestjs/common"
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
