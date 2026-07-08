import "dotenv/config"
import { MetricExporter } from "@google-cloud/opentelemetry-cloud-monitoring-exporter"
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter"
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core"
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg"
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"
import { LangfuseIntegrationExporter } from "@/external/langfuse/langfuse-integration-exporter"

const isTest = process.env.NODE_ENV === "test"
const isProduction = process.env.NODE_ENV === "production"

const spanProcessors = [
  ...(!isTest
    ? [
        new BatchSpanProcessor(
          new LangfuseIntegrationExporter({
            secretKey: process.env.LANGFUSE_SK,
            publicKey: process.env.LANGFUSE_PK,
            baseUrl: process.env.LANGFUSE_BASE_URL,
          }),
        ),
      ]
    : []),
]

if (isProduction) {
  spanProcessors.push(new BatchSpanProcessor(new TraceExporter()))
} else if (process.env.OTEL_CONSOLE_EXPORT === "true") {
  spanProcessors.push(new BatchSpanProcessor(new ConsoleSpanExporter()))
}

const metricReader = isProduction
  ? new PeriodicExportingMetricReader({ exporter: new MetricExporter() })
  : undefined

export const sdk = new NodeSDK({
  spanProcessors,
  ...(metricReader && { metricReader }),
  instrumentations: isTest ? [] : [new NestInstrumentation(), new PgInstrumentation()],
})

sdk.start()

// console.error is intentional here — this file runs before NestJS bootstrap,
// so the structured logger is not available yet
process.on("unhandledRejection", (error) => {
  console.error("[OTEL] Unhandled rejection:", error)
})
