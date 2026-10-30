import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base"
import { UrlRedactingSpanProcessor } from "./url-redacting-span-processor"

describe("UrlRedactingSpanProcessor", () => {
  it("redacts the visitor's message from the request URL before export", () => {
    const exporter = new InMemorySpanExporter()
    const provider = new BasicTracerProvider({
      spanProcessors: [new UrlRedactingSpanProcessor(), new SimpleSpanProcessor(exporter)],
    })

    provider
      .getTracer("test")
      .startSpan("PublicChatV1Controller.streamMessages", {
        attributes: {
          "url.full": "/public/v1/agents/token-1/sessions/session-1/messages/stream?q=secret",
        },
      })
      .end()

    expect(exporter.getFinishedSpans()[0]?.attributes["url.full"]).toBe(
      "/public/v1/agents/token-1/sessions/session-1/messages/stream?q=[redacted]",
    )
  })
})
