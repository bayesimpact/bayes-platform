import { telemetryTraceUrl } from "@/external/llm/telemetry/telemetry-trace-url"

describe("telemetryTraceUrl", () => {
  const savedTemplate = process.env.TRACE_URL_TEMPLATE

  afterEach(() => {
    if (savedTemplate === undefined) delete process.env.TRACE_URL_TEMPLATE
    else process.env.TRACE_URL_TEMPLATE = savedTemplate
  })

  it("builds the link from the template", () => {
    process.env.TRACE_URL_TEMPLATE = "https://traces.example.org/sessions/{traceId}"

    expect(telemetryTraceUrl("trace-1")).toBe("https://traces.example.org/sessions/trace-1")
  })

  it("replaces every occurrence of the trace id", () => {
    process.env.TRACE_URL_TEMPLATE = "https://traces.example.org/{traceId}?focus={traceId}"

    expect(telemetryTraceUrl("trace-1")).toBe("https://traces.example.org/trace-1?focus=trace-1")
  })

  it("encodes the trace id", () => {
    process.env.TRACE_URL_TEMPLATE = "https://traces.example.org/sessions/{traceId}"

    expect(telemetryTraceUrl("a/b c")).toBe("https://traces.example.org/sessions/a%2Fb%20c")
  })

  it("is undefined without a template", () => {
    delete process.env.TRACE_URL_TEMPLATE

    expect(telemetryTraceUrl("trace-1")).toBeUndefined()
  })
})
