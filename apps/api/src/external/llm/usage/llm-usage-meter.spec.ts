import type { LanguageModelUsage } from "ai"
import type { LLMCallContext } from "@/common/interfaces/llm-provider.interface"
import type { LlmUsageRepository } from "./llm-usage.repository"
import { LlmUsageMeter } from "./llm-usage-meter"

const callContext: LLMCallContext = {
  traceId: "trace-id",
  agentSessionId: "agent-session-id",
  currentTurn: 1,
  organizationId: "organization-id",
  projectId: "project-id",
  agentId: "agent-id",
  revision: 1,
  agentMessageId: "agent-message-id",
}

function usage(overrides: Partial<LanguageModelUsage> = {}): LanguageModelUsage {
  return {
    inputTokens: 120,
    inputTokenDetails: { noCacheTokens: 100, cacheReadTokens: 20, cacheWriteTokens: 5 },
    outputTokens: 80,
    outputTokenDetails: { textTokens: 60, reasoningTokens: 20 },
    totalTokens: 200,
    ...overrides,
  } as LanguageModelUsage
}

/** The ledger insert is fire-and-forget: let the microtask queue settle. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve))
}

describe("LlmUsageMeter.recordUsage", () => {
  it("writes one ledger row per call, with the token counts split by kind", async () => {
    const insert = jest.fn().mockResolvedValue(undefined)
    const meter = new LlmUsageMeter({ insert } as unknown as LlmUsageRepository)

    meter.recordUsage({
      callContext,
      model: "gemini-3.5-flash",
      provider: "Vertex",
      callKind: "answer",
      usage: usage(),
    })

    await settle()
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith({
      organizationId: "organization-id",
      projectId: "project-id",
      agentId: "agent-id",
      agentMessageId: "agent-message-id",
      model: "gemini-3.5-flash",
      provider: "Vertex",
      callKind: "answer",
      inputTokens: 120,
      outputTokens: 80,
      cacheReadTokens: 20,
      cacheWriteTokens: 5,
      reasoningTokens: 20,
    })
  })

  it("stores a null agent_message_id when the call has no message", async () => {
    const insert = jest.fn().mockResolvedValue(undefined)
    const meter = new LlmUsageMeter({ insert } as unknown as LlmUsageRepository)

    meter.recordUsage({
      callContext: { ...callContext, agentMessageId: undefined },
      model: "gemma-4-27b",
      provider: "Gemma",
      callKind: "internal",
      usage: usage(),
    })

    await settle()
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ agentMessageId: null, callKind: "internal" }),
    )
  })

  it("defaults every missing token count to zero", async () => {
    const insert = jest.fn().mockResolvedValue(undefined)
    const meter = new LlmUsageMeter({ insert } as unknown as LlmUsageRepository)

    meter.recordUsage({
      callContext,
      model: "gemma-4-27b",
      provider: "Gemma",
      callKind: "internal",
      usage: usage({
        inputTokens: undefined,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
        },
        outputTokens: undefined,
        outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
      }),
    })

    await settle()
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
      }),
    )
  })

  it("never breaks the call when the ledger write fails", async () => {
    const insert = jest.fn().mockRejectedValue(new Error("database down"))
    const warn = jest.spyOn(console, "log").mockImplementation(() => undefined)
    try {
      const meter = new LlmUsageMeter({ insert } as unknown as LlmUsageRepository)
      expect(() =>
        meter.recordUsage({
          callContext,
          model: "gemma-4-27b",
          provider: "Gemma",
          callKind: "internal",
          usage: usage(),
        }),
      ).not.toThrow()
      await settle()
    } finally {
      warn.mockRestore()
    }
  })
})
