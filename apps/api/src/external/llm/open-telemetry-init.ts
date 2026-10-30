import "dotenv/config"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto"
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core"
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg"
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { NodeSDK } from "@opentelemetry/sdk-node"
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import { UrlRedactingSpanProcessor } from "./url-redacting-span-processor"

const isTest = process.env.NODE_ENV === "test"
// The exporters read the endpoint (the OpenTelemetry gateway of the cluster)
// from OTEL_EXPORTER_OTLP_ENDPOINT; without it, nothing is exported.
const isOtlpExportEnabled = !isTest && !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT

// First, so no exporter ever sees a request URL with a credential or a visitor's message.
const spanProcessors: SpanProcessor[] = [new UrlRedactingSpanProcessor()]
if (isOtlpExportEnabled) spanProcessors.push(new BatchSpanProcessor(new OTLPTraceExporter()))

if (process.env.OTEL_CONSOLE_EXPORT === "true") {
  spanProcessors.push(new BatchSpanProcessor(new ConsoleSpanExporter()))
}

const metricReader = isOtlpExportEnabled
  ? new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() })
  : undefined

export const sdk = new NodeSDK({
  spanProcessors,
  // Always explicit: without metricReaders, NodeSDK builds a default OTLP reader from the
  // environment, whose 60 s export timer is never stopped (in tests it kept every finished
  // test file's module graph in memory).
  metricReaders: metricReader ? [metricReader] : [],
  instrumentations: isTest ? [] : [new NestInstrumentation(), new PgInstrumentation()],
})

sdk.start()

// console.error is intentional here — this file runs before NestJS bootstrap,
// so the structured logger is not available yet
process.on("unhandledRejection", (error) => {
  console.error("[OTEL] Unhandled rejection:", error)
})
