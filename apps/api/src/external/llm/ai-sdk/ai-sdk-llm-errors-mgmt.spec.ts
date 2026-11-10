import { AgentModel } from "@caseai-connect/api-contracts"
import { trace } from "@opentelemetry/api"
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type TimedEvent,
} from "@opentelemetry/sdk-trace-base"
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import type {
  LLMCallContext,
  LLMConfig,
  LLMServiceTier,
} from "@/common/interfaces/llm-provider.interface"
import { randomSleep, sleep } from "@/common/utils/sleep"
import {
  bareBodyTimeoutError,
  connectTimeoutError,
  headersTimeoutError,
  invalidArgumentError,
  rateLimitError,
  wrappedInRetryError,
} from "@/external/llm/ai-sdk/llm-errors.fixtures"
import { AISDKMockProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mock.provider"

// The policy waits 0.2s to 10s between attempts, and 1s to 5s before the
// standard-tier fallback. Mocking the waits keeps the suite fast and records
// the delays, so they can be checked.
jest.mock("@/common/utils/sleep", () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
  randomSleep: jest.fn().mockResolvedValue(undefined),
}))

const AGENT_ID = "agent-1"

const callContext: LLMCallContext = {
  traceId: "trace-1",
  agentSessionId: "session-1",
  currentTurn: 1,
  organizationId: "organization-1",
  projectId: "project-1",
  agentId: AGENT_ID,
  revision: 1,
}

const buildConfig = ({
  nbRetriesOnSpecificErrors = 2,
  serviceTier,
  fallbackToStandardTier = false,
  forceNoRetry,
}: {
  nbRetriesOnSpecificErrors?: number
  serviceTier?: LLMServiceTier
  fallbackToStandardTier?: boolean
  forceNoRetry?: boolean
} = {}): LLMConfig =>
  ({
    model: AgentModel._Mock,
    serviceTier,
    nbRetriesOnSpecificErrors,
    fallbackToStandardTier,
    forceNoRetry,
  }) as LLMConfig

describe("AISDKLLMErrorsMgmt - retries on specific errors", () => {
  const provider = new AISDKMockProvider()
  const exporter = new InMemorySpanExporter()
  const tracerProvider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  })

  beforeAll(() => {
    // Registers the async context manager too: without it the active span is
    // never found and the retry events are dropped.
    tracerProvider.register()
  })

  beforeEach(() => {
    provider.resetMock()
    exporter.reset()
    jest.mocked(sleep).mockClear()
    jest.mocked(randomSleep).mockClear()
  })

  afterAll(async () => {
    await tracerProvider.shutdown()
  })

  /** The retry events go on the active span: every call runs inside one. */
  const generateTextInSpan = (config: LLMConfig): Promise<string> =>
    trace.getTracer("ai-sdk-llm-errors-mgmt.spec").startActiveSpan("llm-call", async (span) => {
      try {
        return await provider.generateText({
          prompt: "ping",
          config,
          callContext,
          additionalMetadata: {},
        })
      } finally {
        span.end()
      }
    })

  const recordedDelays = (): number[] =>
    jest.mocked(sleep).mock.calls.map(([delay]) => delay as number)
  const tiersOfCalls = (): LLMServiceTier[] => provider.getCalls().map((call) => call.serviceTier)
  const eventsNamed = (name: string): TimedEvent[] =>
    (exporter.getFinishedSpans().find((span) => span.name === "llm-call")?.events ?? []).filter(
      (event) => event.name === name,
    )

  describe("retriable errors", () => {
    it("retries a connect timeout and returns the recovered answer", async () => {
      provider.addErrorTurns(AGENT_ID, 2, connectTimeoutError)
      provider.addTextTurn(AGENT_ID, "recovered")

      await expect(generateTextInSpan(buildConfig())).resolves.toBe("recovered")
      expect(provider.getCalls()).toHaveLength(3)
    })

    it("waits 2s to 10s between attempts on a connect timeout", async () => {
      provider.addErrorTurns(AGENT_ID, 2, connectTimeoutError)
      provider.addTextTurn(AGENT_ID, "recovered")

      await generateTextInSpan(buildConfig())

      const delays = recordedDelays()
      expect(delays).toHaveLength(2)
      for (const delay of delays) {
        expect(delay).toBeGreaterThanOrEqual(2000)
        expect(delay).toBeLessThan(10000)
      }
    })

    it("waits 0.2s to 5s between attempts on a headers timeout", async () => {
      provider.addErrorTurn(AGENT_ID, headersTimeoutError())
      provider.addTextTurn(AGENT_ID, "recovered")

      await generateTextInSpan(buildConfig())

      const delays = recordedDelays()
      expect(delays).toHaveLength(1)
      expect(delays[0]).toBeGreaterThanOrEqual(200)
      expect(delays[0]).toBeLessThan(5000)
    })

    it("retries a 429 and waits 2s to 10s", async () => {
      provider.addErrorTurn(AGENT_ID, rateLimitError())
      provider.addTextTurn(AGENT_ID, "recovered")

      await expect(generateTextInSpan(buildConfig())).resolves.toBe("recovered")
      expect(recordedDelays()[0]).toBeGreaterThanOrEqual(2000)
    })

    it("reads the code of a bare undici error, without the APICallError wrapper", async () => {
      provider.addErrorTurn(AGENT_ID, bareBodyTimeoutError())
      provider.addTextTurn(AGENT_ID, "recovered")

      await expect(generateTextInSpan(buildConfig())).resolves.toBe("recovered")
      expect(provider.getCalls()).toHaveLength(2)
    })

    it("finds the error nested inside a RetryError", async () => {
      provider.addErrorTurn(AGENT_ID, wrappedInRetryError(connectTimeoutError()))
      provider.addTextTurn(AGENT_ID, "recovered")

      await expect(generateTextInSpan(buildConfig())).resolves.toBe("recovered")
      expect(provider.getCalls()).toHaveLength(2)
    })

    it("applies the same policy to generateStructuredOutput", async () => {
      provider.addErrorTurn(AGENT_ID, connectTimeoutError())
      provider.addObjectTurn(AGENT_ID, { answer: "recovered" })

      const result = await provider.generateStructuredOutput({
        message: { role: "user", content: "ping" },
        schema: {
          type: "object",
          properties: { answer: { type: "string" } },
          required: ["answer"],
          additionalProperties: false,
        },
        config: buildConfig(),
        callContext,
        additionalMetadata: {},
      })

      expect(result).toEqual({ answer: "recovered" })
      expect(provider.getCalls()).toHaveLength(2)
    })
  })

  describe("errors not worth retrying", () => {
    it("throws a 400 on the first attempt", async () => {
      provider.addErrorTurn(AGENT_ID, invalidArgumentError())
      provider.addTextTurn(AGENT_ID, "never reached")

      await expect(generateTextInSpan(buildConfig())).rejects.toThrow("Invalid argument")
      expect(provider.getCalls()).toHaveLength(1)
      expect(sleep).not.toHaveBeenCalled()
      expect(eventsNamed("retry")).toHaveLength(0)
    })

    it("leaves the retries to the AI SDK when the call asks for none", async () => {
      provider.addErrorTurn(AGENT_ID, bareBodyTimeoutError())
      provider.addTextTurn(AGENT_ID, "never reached")

      await expect(
        generateTextInSpan(buildConfig({ nbRetriesOnSpecificErrors: 0 })),
      ).rejects.toThrow()
      expect(provider.getCalls()).toHaveLength(1)
      expect(sleep).not.toHaveBeenCalled()
    })

    it("turns the AI SDK's own retries off with forceNoRetry", async () => {
      // Without it, the AI SDK would replay a 429 twice by itself.
      provider.addErrorTurns(AGENT_ID, 3, rateLimitError)
      provider.addTextTurn(AGENT_ID, "never reached")

      await expect(
        generateTextInSpan(buildConfig({ nbRetriesOnSpecificErrors: 0, forceNoRetry: true })),
      ).rejects.toThrow("Too Many Requests")
      expect(provider.getCalls()).toHaveLength(1)
    })
  })

  it("throws the last error after 1 + nbRetriesOnSpecificErrors attempts", async () => {
    provider.addErrorTurns(AGENT_ID, 3, rateLimitError)

    await expect(generateTextInSpan(buildConfig())).rejects.toThrow("Too Many Requests")
    expect(provider.getCalls()).toHaveLength(3)
  })

  describe("flex tier fallback", () => {
    const flexConfig = (fallbackToStandardTier: boolean) =>
      buildConfig({ serviceTier: "flex", fallbackToStandardTier })

    it("falls back to the standard tier once the flex retries are exhausted", async () => {
      provider.addErrorTurns(AGENT_ID, 3, rateLimitError)
      provider.addTextTurn(AGENT_ID, "answered on the standard tier")

      await expect(generateTextInSpan(flexConfig(true))).resolves.toBe(
        "answered on the standard tier",
      )
      expect(tiersOfCalls()).toEqual(["flex", "flex", "flex", undefined])
      expect(randomSleep).toHaveBeenCalledWith(1000, 5000)
    })

    it("gives the standard tier a single attempt, even on a retriable error", async () => {
      provider.addErrorTurns(AGENT_ID, 4, rateLimitError)
      provider.addTextTurn(AGENT_ID, "never reached")

      await expect(generateTextInSpan(flexConfig(true))).rejects.toThrow("Too Many Requests")
      expect(tiersOfCalls()).toEqual(["flex", "flex", "flex", undefined])
    })

    it("falls back after a single flex attempt when the call asks for no retry", async () => {
      provider.addErrorTurn(AGENT_ID, rateLimitError())
      provider.addTextTurn(AGENT_ID, "answered on the standard tier")

      const config = buildConfig({
        serviceTier: "flex",
        fallbackToStandardTier: true,
        nbRetriesOnSpecificErrors: 0,
        // Keeps the AI SDK's own retries out of the count.
        forceNoRetry: true,
      })
      await expect(generateTextInSpan(config)).resolves.toBe("answered on the standard tier")
      expect(tiersOfCalls()).toEqual(["flex", undefined])
    })

    it("throws without a standard-tier attempt when the fallback is off", async () => {
      provider.addErrorTurns(AGENT_ID, 3, rateLimitError)
      provider.addTextTurn(AGENT_ID, "never reached")

      await expect(generateTextInSpan(flexConfig(false))).rejects.toThrow("Too Many Requests")
      expect(tiersOfCalls()).toEqual(["flex", "flex", "flex"])
      expect(randomSleep).not.toHaveBeenCalled()
    })
  })

  describe("OpenTelemetry events", () => {
    it("adds one retry event per failed attempt, with the reason", async () => {
      provider.addErrorTurns(AGENT_ID, 2, connectTimeoutError)
      provider.addTextTurn(AGENT_ID, "recovered")

      await generateTextInSpan(buildConfig())

      const retries = eventsNamed("retry")
      expect(retries).toHaveLength(2)
      expect(retries[0]?.attributes).toMatchObject({
        "retry.reason": "CONNECT_TIMEOUT",
        "retry.attempt": "current attempt 1/3",
      })
      expect(retries[1]?.attributes?.["retry.attempt"]).toBe("current attempt 2/3")
      expect(eventsNamed("retry-info")).toHaveLength(0)
    })

    it("labels a 429 as ERROR_429 and a headers timeout as CLIENT_TIMEOUT", async () => {
      provider.addErrorTurn(AGENT_ID, rateLimitError())
      provider.addTextTurn(AGENT_ID, "recovered")
      await generateTextInSpan(buildConfig())
      expect(eventsNamed("retry")[0]?.attributes?.["retry.reason"]).toBe("ERROR_429")

      exporter.reset()
      provider.addErrorTurn(AGENT_ID, headersTimeoutError())
      provider.addTextTurn(AGENT_ID, "recovered")
      await generateTextInSpan(buildConfig())
      expect(eventsNamed("retry")[0]?.attributes?.["retry.reason"]).toBe("CLIENT_TIMEOUT")
    })

    it("reports the retry limit and the final error", async () => {
      provider.addErrorTurns(AGENT_ID, 3, rateLimitError)

      await expect(generateTextInSpan(buildConfig())).rejects.toThrow()

      const retries = eventsNamed("retry")
      expect(retries).toHaveLength(3)
      expect(retries[2]?.attributes?.["retry.message"]).toContain("retry limit reached")
      expect(eventsNamed("retry-info")[0]?.attributes?.["retry-info.message"]).toContain(
        "returning error after 3 attempt(s)",
      )
    })

    it("reports the fallback to the standard tier", async () => {
      provider.addErrorTurns(AGENT_ID, 3, rateLimitError)
      provider.addTextTurn(AGENT_ID, "answered on the standard tier")

      await generateTextInSpan(buildConfig({ serviceTier: "flex", fallbackToStandardTier: true }))

      const message = eventsNamed("retry-info")[0]?.attributes?.["retry-info.message"]
      expect(message).toContain("no flex capacity after 3 attempt(s)")
      expect(message).toContain("falling back to the standard tier")
    })

    it("reports that no fallback is set", async () => {
      provider.addErrorTurns(AGENT_ID, 3, rateLimitError)

      await expect(
        generateTextInSpan(buildConfig({ serviceTier: "flex", fallbackToStandardTier: false })),
      ).rejects.toThrow()

      expect(eventsNamed("retry-info")[0]?.attributes?.["retry-info.message"]).toContain(
        "no fallback to standard-tier set",
      )
    })
  })
})
