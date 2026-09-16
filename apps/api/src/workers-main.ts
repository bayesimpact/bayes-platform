import "./external/llm/open-telemetry-init" // must be first — patches http/pg before they are imported
import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { registerGracefulShutdown } from "@/common/lifecycle/graceful-shutdown"
import { getLogLevels, StructuredLogger } from "@/common/logger/structured-logger"
import { getWorkerShutdownTimeoutMs } from "@/config/shutdown-timeouts.config"
import {
  getWorkerDoclingHealthCheckTimeoutMs,
  getWorkerHealthPort,
} from "@/config/workers-runtime.config"
import {
  getDoclingTimeoutMs,
  getDoclingVersion,
  getDocumentChunkerCommand,
  isDoclingEnabled,
} from "@/external/docling/docling.cli"
import { runDoclingSelfTestIfEnabled } from "@/external/docling/docling.self-test"
import { WorkersAppModule } from "./workers-app.module"

async function bootstrapWorkersMain() {
  const healthCheckTimeoutMs = getWorkerDoclingHealthCheckTimeoutMs()
  await ensureDoclingIsReadyForWorkers(healthCheckTimeoutMs)
  await runDoclingSelfTestIfEnabled(healthCheckTimeoutMs)
  const isProduction = process.env.NODE_ENV === "production"
  const logLevels = getLogLevels()
  const app = await NestFactory.create(WorkersAppModule, {
    logger: isProduction ? new StructuredLogger(logLevels) : logLevels,
  })
  // BullMQ closes every worker, which waits for its active jobs. The wait is
  // bounded: past the timeout the process exits and BullMQ hands the
  // unfinished jobs back to the queue once their lock expires.
  registerGracefulShutdown({
    close: () => app.close(),
    timeoutMs: getWorkerShutdownTimeoutMs(),
    context: "WorkersMain",
    workLabel: "the jobs in progress",
    timeoutHint: "; they go back to the queue",
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
