import "dotenv/config"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto"
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core"
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg"
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"

const isTest = process.env.NODE_ENV === "test"
// The exporters read the endpoint (the OpenTelemetry gateway of the cluster)
// from OTEL_EXPORTER_OTLP_ENDPOINT; without it, nothing is exported.
const isOtlpExportEnabled = !isTest && !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT

const spanProcessors = isOtlpExportEnabled ? [new BatchSpanProcessor(new OTLPTraceExporter())] : []

if (process.env.OTEL_CONSOLE_EXPORT === "true") {
  spanProcessors.push(new BatchSpanProcessor(new ConsoleSpanExporter()))
}

const metricReader = isOtlpExportEnabled
  ? new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() })
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
