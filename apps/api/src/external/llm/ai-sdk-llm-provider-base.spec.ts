import type { LanguageModelV3StreamPart, LanguageModelV3StreamResult } from "@ai-sdk/provider"
import { AgentModel, AgentProvider } from "@caseai-connect/api-contracts"
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { MockLanguageModelV3 } from "ai/test"
import type {
  LLMChatMessage,
  LLMConfig,
  LLMMetadata,
} from "@/common/interfaces/llm-provider.interface"
import { AISDKLLMProviderBase, type CallOrigin } from "@/external/llm/ai-sdk-llm-provider-base"

const USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
}

/** A minimal, well-formed successful stream result - same shape ai-sdk-mock.provider.ts builds. */
function textStreamResult(text: string, onCancel?: () => void): LanguageModelV3StreamResult {
  const parts: LanguageModelV3StreamPart[] = [
    { type: "text-start", id: "1" },
    { type: "text-delta", id: "1", delta: text },
    { type: "text-end", id: "1" },
    { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage: USAGE },
  ]
  return {
    stream: new ReadableStream<LanguageModelV3StreamPart>({
      start(controller) {
        for (const part of parts) controller.enqueue(part)
        controller.close()
      },
      cancel() {
        onCancel?.()
      },
    }),
  }
}

/**
 * A provider whose `doStream` implementation is fully test-controlled (per attempt number) and
 * whose hedge delay is injectable - lets these tests drive `doStreamWithRetry`'s hedge/race logic
 * through the real public `streamChatResponse` path without needing a live model.
 */
class TestHedgingProvider extends AISDKLLMProviderBase {
  attemptCount = 0
  doStreamImpl: (attemptNumber: number) => PromiseLike<LanguageModelV3StreamResult> = () => {
    throw new Error("doStreamImpl not set for this test")
  }

  constructor(private readonly hedgeDelayMs: number | undefined) {
    super()
  }

  protected override getHedgeDelayMs(): number | undefined {
    return this.hedgeDelayMs
  }

  getAgentProvider(): AgentProvider {
    return AgentProvider._Mock
  }

  getTags(): string[] {
    return ["TEST-HEDGING"]
  }

  getLanguageModel(_args: { config: LLMConfig; callOrigin: CallOrigin }) {
    return new MockLanguageModelV3({
      doStream: async () => {
        this.attemptCount += 1
        return this.doStreamImpl(this.attemptCount)
      },
    })
  }
}

async function collectStream(stream: AsyncGenerator<string, void, unknown>): Promise<string[]> {
  const values: string[] = []
  for await (const chunk of stream) values.push(chunk)
  return values
}

const HEDGE_DELAY_MS = 1000

describe("AISDKLLMProviderBase - hedged retry", () => {
  let messages: LLMChatMessage[]
  let config: LLMConfig
  let metadata: LLMMetadata

  beforeEach(() => {
    messages = [{ role: "user", content: "for test purpose" }]
    config = { model: AgentModel._Mock, temperature: 1, systemPrompt: "" }
    metadata = {
      agentId: "agentId",
      agentSessionId: "agentSessionId",
      currentTurn: 0,
      organizationId: "organizationId",
      projectId: "projectId",
      tags: ["**TEST**"],
      traceId: "traceId",
      revision: 1,
    }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("never hedges when the first attempt succeeds quickly", async () => {
    const provider = new TestHedgingProvider(HEDGE_DELAY_MS)
    provider.doStreamImpl = async () => textStreamResult("hello")

    const chunks = await collectStream(provider.streamChatResponse({ messages, config, metadata }))

    expect(chunks.join("")).toBe("hello")
    expect(provider.attemptCount).toBe(1)
  })

  it("falls back to an immediate sequential retry when attempt 1 fails before the hedge delay", async () => {
    const provider = new TestHedgingProvider(HEDGE_DELAY_MS)
    provider.doStreamImpl = (attemptNumber) =>
      attemptNumber === 1
        ? Promise.reject(new Error("fast failure"))
        : Promise.resolve(textStreamResult("recovered"))

    const chunks = await collectStream(provider.streamChatResponse({ messages, config, metadata }))

    expect(chunks.join("")).toBe("recovered")
    expect(provider.attemptCount).toBe(2)
  })

  it("fires a hedged second attempt only once the first has been silent past the hedge delay", async () => {
    jest.useFakeTimers()
    const provider = new TestHedgingProvider(HEDGE_DELAY_MS)
    let resolveAttempt2: (result: LanguageModelV3StreamResult) => void = () => {}
    provider.doStreamImpl = (attemptNumber) =>
      attemptNumber === 1
        ? new Promise(() => {}) // never resolves during this test
        : new Promise((resolve) => {
            resolveAttempt2 = resolve
          })

    const streamPromise = collectStream(provider.streamChatResponse({ messages, config, metadata }))

    await jest.advanceTimersByTimeAsync(HEDGE_DELAY_MS - 1)
    expect(provider.attemptCount).toBe(1)

    await jest.advanceTimersByTimeAsync(2)
    expect(provider.attemptCount).toBe(2)

    resolveAttempt2(textStreamResult("recovered on hedge"))
    const chunks = await streamPromise

    expect(chunks.join("")).toBe("recovered on hedge")
  })

  it("cancels the losing attempt once the winner is known", async () => {
    jest.useFakeTimers()
    const provider = new TestHedgingProvider(HEDGE_DELAY_MS)
    const attempt1Cancel = jest.fn()
    let resolveAttempt1: (result: LanguageModelV3StreamResult) => void = () => {}
    provider.doStreamImpl = (attemptNumber) =>
      attemptNumber === 1
        ? new Promise((resolve) => {
            resolveAttempt1 = resolve
          })
        : Promise.resolve(textStreamResult("winner"))

    const streamPromise = collectStream(provider.streamChatResponse({ messages, config, metadata }))
    await jest.advanceTimersByTimeAsync(HEDGE_DELAY_MS + 1)
    const chunks = await streamPromise
    expect(chunks.join("")).toBe("winner")

    // Attempt 1 finally resolves, late - it should be cancelled, not consumed.
    resolveAttempt1(textStreamResult("too late", attempt1Cancel))
    await jest.advanceTimersByTimeAsync(0)

    expect(attempt1Cancel).toHaveBeenCalledTimes(1)
  })

  it("throws if both the original and the hedged attempt fail", async () => {
    jest.useFakeTimers()
    const provider = new TestHedgingProvider(HEDGE_DELAY_MS)
    let rejectAttempt1: (error: Error) => void = () => {}
    provider.doStreamImpl = (attemptNumber) =>
      attemptNumber === 1
        ? new Promise((_resolve, reject) => {
            rejectAttempt1 = reject
          })
        : Promise.reject(new Error("attempt 2 failed"))

    const streamPromise = collectStream(provider.streamChatResponse({ messages, config, metadata }))
    const assertion = expect(streamPromise).rejects.toThrow()

    await jest.advanceTimersByTimeAsync(HEDGE_DELAY_MS + 1)
    rejectAttempt1(new Error("attempt 1 failed"))

    await assertion
  })

  it("with hedging disabled, behaves exactly like plain sequential retry", async () => {
    const provider = new TestHedgingProvider(undefined)
    provider.doStreamImpl = (attemptNumber) =>
      attemptNumber === 1
        ? Promise.reject(new Error("fails once"))
        : Promise.resolve(textStreamResult("recovered"))

    const chunks = await collectStream(provider.streamChatResponse({ messages, config, metadata }))

    expect(chunks.join("")).toBe("recovered")
    expect(provider.attemptCount).toBe(2)
  })
})
