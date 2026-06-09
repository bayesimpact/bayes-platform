import "./external/llm/open-telemetry-init" // must be first — patches http/pg before they are imported
import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { getLogLevels, StructuredLogger } from "@/common/logger/structured-logger"
import { getWorkerHealthPort } from "@/common/worker-health-port"
import { CpuWorkersAppModule } from "./cpu-workers-app.module"

/**
 * Entrypoint for the CPU worker pool. Unlike gpu-workers-main.ts it does NOT run
 * the Docling health check / self-test and imports nothing from the Docling
 * code path — the extraction-run and URL-crawling workers it hosts never touch
 * local PyTorch extraction.
 */
async function bootstrapCpuWorkersMain() {
  const isProduction = process.env.NODE_ENV === "production"
  const logLevels = getLogLevels()
  const app = await NestFactory.create(CpuWorkersAppModule, {
    logger: isProduction ? new StructuredLogger(logLevels) : logLevels,
  })
  const port = getWorkerHealthPort()
  await app.listen(port)
  Logger.log(
    `CPU workers app started, health endpoint listening on :${port}/healthz`,
    "CpuWorkersMain",
  )
}

void bootstrapCpuWorkersMain()
