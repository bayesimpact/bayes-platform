import { AgentModel, AgentProvider } from "@caseai-connect/api-contracts"
import type {
  LLMConfig,
  LLMServiceTier,
  SpecificProviderOptions,
} from "@/common/interfaces/llm-provider.interface"
import {
  type CapturedRequest,
  callContext,
  collect,
  configFor,
  installFakeFetch,
  installWarningCollector,
  modelsOf,
  openAiResponses,
  openResponses,
} from "@/external/llm/ai-sdk/non-regression/non-regression.harness"
import { AISDKOpenAIProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-openai.provider"

process.env.OPENAI_API_KEY = "test-api-key"

/** Exposes the options the provider sends on each call. */
class TestAISDKOpenAIProvider extends AISDKOpenAIProvider {
  specificProviderOptionsFor(config: LLMConfig): SpecificProviderOptions {
    return this.buildSpecificProviderOptions({ config })
  }
}

const OPENAI_MODELS = modelsOf(AgentProvider.OpenAI)
const REASONING_EFFORTS = ["none", "low", "medium", "high"] as const

/** The options sent on every call, whatever the agent stored. */
const callSettings = { store: false, include: ["reasoning.encrypted_content"] }

const storedEffort = (reasoningEffort: unknown) => ({
  providerOptions: { openai: { reasoningEffort } },
})

describe("AISDKOpenAIProvider model options", () => {
  const provider = new TestAISDKOpenAIProvider()

  it("serves GPT-5.4 and GPT-5.4 mini", () => {
    expect(OPENAI_MODELS.sort()).toEqual([AgentModel.Gpt54, AgentModel.Gpt54Mini].sort())
  })

  describe.each(OPENAI_MODELS)("%s", (model) => {
    describe("schema", () => {
      const schema = provider.getModelOptionsSchema(model)

      it.each(REASONING_EFFORTS)("accepts the reasoning effort %s", (reasoningEffort) => {
        expect(schema.safeParse(storedEffort(reasoningEffort)).success).toBe(true)
      })

      it.each([
        "minimal",
        "xhigh",
        "LOW",
        undefined,
      ])("rejects the reasoning effort %s", (reasoningEffort) => {
        expect(schema.safeParse(storedEffort(reasoningEffort)).success).toBe(false)
      })

      it("drops a temperature", () => {
        expect(schema.parse({ ...storedEffort("low"), temperature: 0.4 })).toEqual(
          storedEffort("low"),
        )
      })
    })

    describe("options sent on a call", () => {
      const sentFor = (modelOptions?: Record<string, unknown>) =>
        provider.specificProviderOptionsFor(configFor(model, { modelOptions }))

      it("sends the low reasoning effort without stored options", () => {
        expect(sentFor()).toEqual({
          providerOptions: { openai: { reasoningEffort: "low", ...callSettings } },
        })
      })

      it.each(REASONING_EFFORTS)("sends the stored reasoning effort %s", (reasoningEffort) => {
        expect(sentFor(storedEffort(reasoningEffort))).toEqual({
          providerOptions: { openai: { reasoningEffort, ...callSettings } },
        })
      })

      it("falls back to the low reasoning effort when the stored one is unknown", () => {
        expect(sentFor(storedEffort("xhigh"))).toEqual({
          providerOptions: { openai: { reasoningEffort: "low", ...callSettings } },
        })
      })

      it("leaves out the options stored for another model", () => {
        const geminiOptions = {
          temperature: 1,
          providerOptions: {
            vertex: { thinkingConfig: { thinkingLevel: "high", includeThoughts: true } },
          },
        }
        expect(sentFor(geminiOptions)).toEqual({
          providerOptions: { openai: { reasoningEffort: "low", ...callSettings } },
        })
      })

      it("never lets the stored options turn on the response storage", () => {
        const storedOptions = {
          providerOptions: { openai: { reasoningEffort: "medium", store: true, include: [] } },
        }
        expect(sentFor(storedOptions)).toEqual({
          providerOptions: { openai: { reasoningEffort: "medium", ...callSettings } },
        })
      })

      it("sends the priority tier the call asks for", () => {
        const config = configFor(model, { serviceTier: "priority" })
        expect(provider.specificProviderOptionsFor(config)).toEqual({
          providerOptions: {
            openai: { reasoningEffort: "low", ...callSettings, serviceTier: "priority" },
          },
        })
      })

      it("leaves out a service tier left in the stored options", () => {
        const storedOptions = {
          providerOptions: { openai: { reasoningEffort: "low", serviceTier: "priority" } },
        }
        expect(sentFor(storedOptions)).toEqual({
          providerOptions: { openai: { reasoningEffort: "low", ...callSettings } },
        })
      })

      it("sends no temperature on an internal call", () => {
        expect(provider.getInternalCallModelOptions(model)).toEqual({})
        expect(sentFor(provider.getInternalCallModelOptions(model))).toEqual({
          providerOptions: { openai: { reasoningEffort: "low", ...callSettings } },
        })
      })
    })

    describe("model metadata", () => {
      it("reports the priority tier the call asks for", () => {
        expect(provider.getModelMetadata(configFor(model, { serviceTier: "priority" }))).toEqual({
          name: model,
          thinkingLevel: "LOW",
          serviceTier: "PRIORITY",
        })
      })

      it("reports the low thinking level without stored options", () => {
        expect(provider.getModelMetadata(configFor(model))).toEqual({
          name: model,
          thinkingLevel: "LOW",
        })
      })

      it.each(REASONING_EFFORTS)("reports the stored reasoning effort %s", (reasoningEffort) => {
        const config = configFor(model, { modelOptions: storedEffort(reasoningEffort) })
        expect(provider.getModelMetadata(config)).toEqual({
          name: model,
          thinkingLevel: reasoningEffort.toUpperCase(),
        })
      })

      it.each([
        "xhigh",
        "LOW",
        42,
        null,
      ])("reports the low reasoning effort sent for the unknown effort %s", (reasoningEffort) => {
        const config = configFor(model, { modelOptions: storedEffort(reasoningEffort) })
        expect(provider.getModelMetadata(config)).toEqual({
          name: model,
          thinkingLevel: "LOW",
        })
        expect(provider.specificProviderOptionsFor(config)).toEqual({
          providerOptions: { openai: { reasoningEffort: "low", ...callSettings } },
        })
      })
    })
  })
})

type Call = "generateText" | "streamChatResponse"
const CALLS: Call[] = ["generateText", "streamChatResponse"]

/** The real AI SDK runs, only the network is replaced: checks the HTTP request to OpenAI. */
describe("AISDKOpenAIProvider request", () => {
  const provider = new AISDKOpenAIProvider()
  let fakeFetch: ReturnType<typeof installFakeFetch>
  let warningCollector: ReturnType<typeof installWarningCollector>

  beforeEach(() => {
    fakeFetch = installFakeFetch()
    warningCollector = installWarningCollector()
  })

  afterEach(() => {
    fakeFetch.restore()
    warningCollector.restore()
  })

  const send = async (
    call: Call,
    model: AgentModel,
    modelOptions?: Record<string, unknown>,
    serviceTier?: LLMServiceTier,
  ): Promise<CapturedRequest> => {
    const config = configFor(model, { modelOptions, serviceTier })
    if (call === "generateText") {
      fakeFetch.respondWith(openResponses.text("Hello"))
      const text = await provider.generateText({
        additionalMetadata: {},
        prompt: "Hi",
        config,
        callContext,
      })
      expect(text).toBe("Hello")
    } else {
      fakeFetch.respondWith(openAiResponses.streamedText(["Hel", "lo"]))
      const text = await collect(
        provider.streamChatResponse({
          additionalMetadata: {},
          messages: [{ role: "user", content: "Hi" }],
          config,
          callContext,
        }),
      )
      expect(text).toBe("Hello")
    }
    return fakeFetch.onlyRequest()
  }

  describe.each(OPENAI_MODELS)("%s", (model) => {
    it.each(CALLS)("calls the Responses API of OpenAI on %s", async (call) => {
      const request = await send(call, model)

      expect(request.url).toBe("https://api.openai.com/v1/responses")
      expect(request.headers.authorization).toBe("Bearer test-api-key")
      expect(request.body.model).toBe(model)
    })

    it.each(CALLS)("keeps the conversation out of OpenAI's storage on %s", async (call) => {
      const request = await send(call, model)

      expect(request.body.store).toBe(false)
      expect(request.body.include).toEqual(["reasoning.encrypted_content"])
      expect(warningCollector.warnings).toEqual([])
    })

    it.each(CALLS)("sends the low reasoning effort by default on %s", async (call) => {
      const request = await send(call, model)

      expect(request.body.reasoning).toEqual({ effort: "low" })
    })

    it.each(CALLS)("sends no temperature, even a stored one, on %s", async (call) => {
      const request = await send(call, model, { ...storedEffort("high"), temperature: 0.4 })

      expect(request.body).not.toHaveProperty("temperature")
      expect(request.body.reasoning).toEqual({ effort: "high" })
      expect(warningCollector.warnings).toEqual([])
    })

    it.each(CALLS)("sends the priority tier the call asks for on %s", async (call) => {
      const request = await send(call, model, undefined, "priority")

      expect(request.body.service_tier).toBe("priority")
      expect(warningCollector.warnings).toEqual([])
    })

    it.each(CALLS)("sends no service tier when the call asks for none on %s", async (call) => {
      const storedTier = {
        providerOptions: { openai: { reasoningEffort: "low", serviceTier: "priority" } },
      }
      const request = await send(call, model, storedTier)

      expect(request.body).not.toHaveProperty("service_tier")
    })

    it.each(CALLS)("sends the low reasoning effort for an unknown one on %s", async (call) => {
      const request = await send(call, model, storedEffort("xhigh"))

      expect(request.body.reasoning).toEqual({ effort: "low" })
    })
  })
})
