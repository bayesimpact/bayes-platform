import type { Span, SpanProcessor } from "@opentelemetry/sdk-trace-base"
import { redactUrl } from "../../common/logger/log-redaction"

/** Span attribute the NestJS instrumentation fills with the request URL, query string included. */
const URL_FULL_ATTRIBUTE = "url.full"

/**
 * Redacts credentials and visitors' messages (`?q=` of the public chat v1 GET stream) from the
 * request URL of each span before any exporter sees it. Exports nothing itself.
 */
export class UrlRedactingSpanProcessor implements SpanProcessor {
  onStart(span: Span): void {
    const url = span.attributes[URL_FULL_ATTRIBUTE]
    if (typeof url === "string") span.setAttribute(URL_FULL_ATTRIBUTE, redactUrl(url))
  }

  onEnd(): void {}

  forceFlush(): Promise<void> {
    return Promise.resolve()
  }

  shutdown(): Promise<void> {
    return Promise.resolve()
  }
}
