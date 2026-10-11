import type { LanguageModelV3 } from "@ai-sdk/provider"
import { AgentModel, AgentProvider, AgentThinkingLevel } from "@caseai-connect/api-contracts"
import { Agent, fetch as undiciFetch } from "undici"
import { z } from "zod"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { AISDKLLMFetchMgmt } from "@/external/llm/ai-sdk/ai-sdk-llm-fetch-mgmt"
import { defineModelOptions, type ModelOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"

jest.mock("undici", () => ({
  Agent: jest.fn(),
  fetch: jest.fn().mockResolvedValue(new Response("{}")),
}))

class TestFetchMgmt extends AISDKLLMFetchMgmt<AgentProvider._Mock> {
  protected readonly modelOptions: Record<AgentModel._Mock, ModelOptions> = {
    [AgentModel._Mock]: defineModelOptions(z.object({ temperature: z.number() }), {
      temperature: 0,
    }),
  }

  getAgentProvider(): AgentProvider._Mock {
    return AgentProvider._Mock
  }
  getLanguageModel(): LanguageModelV3 {
    throw new Error("TestFetchMgmt builds no model")
  }
  getTags(): string[] {
    return []
  }

  fetchForConfig(config: LLMConfig): typeof globalThis.fetch {
    return this.fetchFor(config)
  }
}

const config: LLMConfig = {
  model: AgentModel._Mock,
  modelOptions: { temperature: 0 },
  serviceTier: undefined,
  thinkingLevel: AgentThinkingLevel.Auto,
}
const extendedConfig: LLMConfig = { ...config, useExtendedTimeouts: true }

const TIMEOUT_ENV_KEYS = [
  "VERTEX_FETCH_HEADERS_TIMEOUT_MS",
  "VERTEX_FETCH_BODY_TIMEOUT_MS",
  "VERTEX_FETCH_CONNECT_TIMEOUT_MS",
]

describe("AISDKLLMFetchMgmt", () => {
  const savedEnv = Object.fromEntries(TIMEOUT_ENV_KEYS.map((key) => [key, process.env[key]]))

  beforeEach(() => {
    for (const key of TIMEOUT_ENV_KEYS) delete process.env[key]
    jest.mocked(Agent).mockClear()
    jest.mocked(undiciFetch).mockClear()
  })

  afterEach(() => {
    for (const key of TIMEOUT_ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
    jest.restoreAllMocks()
  })

  it("goes through the global fetch when the call does not opt in", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"))

    await new TestFetchMgmt().fetchForConfig(config)("https://model.test", { method: "POST" })

    expect(fetchSpy).toHaveBeenCalledWith("https://model.test", { method: "POST" })
    expect(undiciFetch).not.toHaveBeenCalled()
    expect(Agent).not.toHaveBeenCalled()
  })

  it("goes through the extended-timeout dispatcher when the call opts in", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch")

    await new TestFetchMgmt().fetchForConfig(extendedConfig)("https://model.test", {
      method: "POST",
    })

    const dispatcher = jest.mocked(Agent).mock.instances[0]
    expect(undiciFetch).toHaveBeenCalledWith("https://model.test", {
      method: "POST",
      dispatcher,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("applies the default timeouts, or the ones the env sets", async () => {
    process.env.VERTEX_FETCH_HEADERS_TIMEOUT_MS = "60000"
    process.env.VERTEX_FETCH_CONNECT_TIMEOUT_MS = "not-a-number"

    await new TestFetchMgmt().fetchForConfig(extendedConfig)("https://model.test")

    expect(Agent).toHaveBeenCalledWith({
      headersTimeout: 60_000,
      bodyTimeout: 30 * 60 * 1000,
      connectTimeout: 30 * 1000,
    })
  })

  it("creates one dispatcher for the provider's lifetime", async () => {
    const fetchMgmt = new TestFetchMgmt()

    await fetchMgmt.fetchForConfig(extendedConfig)("https://model.test")
    await fetchMgmt.fetchForConfig(extendedConfig)("https://model.test")

    expect(Agent).toHaveBeenCalledTimes(1)
  })
})
