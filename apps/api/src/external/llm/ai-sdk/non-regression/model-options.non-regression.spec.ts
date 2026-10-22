import { type AgentModel, AgentProvider } from "@caseai-connect/api-contracts"
import type { LLMServiceTier } from "@/common/interfaces/llm-provider.interface"
import type { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"
import {
  type CapturedRequest,
  callContext,
  collect,
  configFor,
  gemini,
  installFakeFetch,
  installWarningCollector,
  modelOptionLeaves,
  modelsOf,
  openAiChat,
  openAiResponses,
  openResponses,
  readOption,
  withOption,
} from "@/external/llm/ai-sdk/non-regression/non-regression.harness"
import { AISDKGemmaProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-gemma.provider"
import { AISDKMedGemmaProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-med-gemma.provider"
import { AISDKMistralProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mistral.provider"
import { AISDKVertexProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-vertex.provider"
import { AISDKVertex3Provider } from "@/external/llm/ai-sdk/providers/ai-sdk-vertex3.provider"

jest.mock("google-auth-library", () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: async () => ({ getAccessToken: async () => ({ token: "test-access-token" }) }),
  })),
}))

process.env.GOOGLE_VERTEX_PROJECT = "test-project"
process.env.GOOGLE_VERTEX_LOCATION = "europe-west1"
for (const key of ["GEMMA4_26B", "MISTRALSMALL31_24B", "MEDGEMMA10_27B"]) {
  process.env[`VLLM_${key}_URL`] = `https://${key.toLowerCase()}.vllm.test/`
  process.env[`VLLM_${key}_APIKEY`] = "test-api-key"
}

/** Where an option of the agent ends up in the HTTP request the AI SDK sends. */
type OptionLocations = Record<string, (request: CapturedRequest) => unknown>

/** The Gemini API (Vertex): generation settings in the body, the service tier in a header. */
const GEMINI_LOCATIONS: OptionLocations = {
  temperature: (request) => readOption(request.body, ["generationConfig", "temperature"]),
  "providerOptions.vertex.thinkingConfig.thinkingLevel": (request) =>
    readOption(request.body, ["generationConfig", "thinkingConfig", "thinkingLevel"]),
  "providerOptions.vertex.thinkingConfig.includeThoughts": (request) =>
    readOption(request.body, ["generationConfig", "thinkingConfig", "includeThoughts"]),
  "providerOptions.vertex.sharedRequestType": (request) =>
    request.headers["x-vertex-ai-llm-shared-request-type"],
}

/** The OpenAI chat and Open Responses APIs (vLLM): settings at the top of the body. */
const OPENAI_LOCATIONS: OptionLocations = {
  temperature: (request) => request.body.temperature,
}

type Call = "generateText" | "streamChatResponse"

type ProviderUnderTest = {
  provider: AgentProvider
  /** Only what the suite calls: each provider is typed with its own models. */
  instance: Pick<
    AISDKLLMProviderBase,
    "generateText" | "streamChatResponse" | "getModelOptions" | "getModelOptionsSchema"
  >
  locations: OptionLocations
  responseFor: Record<Call, () => Response>
}

const PROVIDERS: ProviderUnderTest[] = [
  {
    provider: AgentProvider.Vertex3,
    instance: new AISDKVertex3Provider(),
    locations: GEMINI_LOCATIONS,
    responseFor: {
      generateText: () => gemini.text("Hello"),
      streamChatResponse: () => gemini.streamedText(["Hel", "lo"]),
    },
  },
  {
    provider: AgentProvider.Vertex,
    instance: new AISDKVertexProvider(),
    locations: GEMINI_LOCATIONS,
    responseFor: {
      generateText: () => gemini.text("Hello"),
      streamChatResponse: () => gemini.streamedText(["Hel", "lo"]),
    },
  },
  {
    provider: AgentProvider.Gemma,
    instance: new AISDKGemmaProvider(),
    locations: OPENAI_LOCATIONS,
    responseFor: {
      generateText: () => openAiChat.text("Hello"),
      streamChatResponse: () => openAiChat.streamedText(["Hel", "lo"]),
    },
  },
  {
    provider: AgentProvider.Mistral,
    instance: new AISDKMistralProvider(),
    locations: OPENAI_LOCATIONS,
    responseFor: {
      generateText: () => openAiChat.text("Hello"),
      streamChatResponse: () => openAiChat.streamedText(["Hel", "lo"]),
    },
  },
  {
    provider: AgentProvider.MedGemma,
    instance: new AISDKMedGemmaProvider(),
    locations: OPENAI_LOCATIONS,
    responseFor: {
      // Plain text through the Open Responses API, the streamed chat through
      // OpenAI's Responses API (not the chat completions of the other vLLM models).
      generateText: () => openResponses.text("Hello"),
      streamChatResponse: () => openAiResponses.streamedText(["Hel", "lo"]),
    },
  },
]

const CALLS: Call[] = ["generateText", "streamChatResponse"]

/** The option the call sets (project flags and agent toggle), never the stored options. */
const SERVICE_TIER_OPTION = "providerOptions.vertex.sharedRequestType"

/**
 * Every option a model declares reaches the model's API, with the value the
 * agent set, through every kind of call. The options are read from the
 * models' schemas: an option added to a provider is covered as soon as its
 * place in the request is listed in the provider's locations.
 */
describe("AI SDK non-regression - model options reach the request", () => {
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

  // A new model of a provider below is covered on its own; a new provider is
  // not, until it is added to PROVIDERS. The mock calls no API.
  it("covers every provider that calls a model", () => {
    const covered = PROVIDERS.map((providerUnderTest) => providerUnderTest.provider)
    const uncovered = Object.values(AgentProvider).filter(
      (provider) => provider !== AgentProvider._Mock && !covered.includes(provider),
    )
    expect(uncovered).toEqual([])
  })

  /** Runs one call of the provider and returns the request it sent. */
  const send = async (
    providerUnderTest: ProviderUnderTest,
    call: Call,
    model: AgentModel,
    modelOptions: Record<string, unknown> | undefined,
    serviceTier?: LLMServiceTier,
  ): Promise<CapturedRequest> => {
    fakeFetch.respondWith(providerUnderTest.responseFor[call]())
    const config = configFor(model, { modelOptions, serviceTier })
    const text =
      call === "generateText"
        ? await providerUnderTest.instance.generateText({ prompt: "Hi", config, callContext })
        : await collect(
            providerUnderTest.instance.streamChatResponse({
              messages: [{ role: "user", content: "Hi" }],
              config,
              callContext,
            }),
          )
    expect(text).toBe("Hello")
    return fakeFetch.onlyRequest()
  }

  describe.each(PROVIDERS)("$provider", (providerUnderTest) => {
    const models = modelsOf(providerUnderTest.provider)

    it("serves at least one model", () => {
      expect(models.length).toBeGreaterThan(0)
    })

    describe.each(models)("%s", (model) => {
      const leaves = modelOptionLeaves(providerUnderTest.instance, model)
      const defaults = providerUnderTest.instance.getModelOptions(model) as Record<string, unknown>

      it("declares only options whose place in the request is known", () => {
        const unknownPaths = leaves
          .map((leaf) => leaf.path.join("."))
          .filter((path) => !(path in providerUnderTest.locations))
        expect(unknownPaths).toEqual([])
      })

      it.each(CALLS)("sends the model's default options on %s", async (call) => {
        const request = await send(providerUnderTest, call, model, undefined)

        for (const leaf of leaves) {
          const expected = readOption(defaults, leaf.path)
          const location = providerUnderTest.locations[leaf.path.join(".")]
          expect({ option: leaf.path.join("."), sent: location?.(request) }).toEqual({
            option: leaf.path.join("."),
            sent: expected,
          })
        }
        expect(warningCollector.warnings).toEqual([])
      })

      const cases = leaves.flatMap((leaf) =>
        leaf.samples.flatMap((value) =>
          CALLS.map((call) => ({ option: leaf.path.join("."), path: leaf.path, value, call })),
        ),
      )

      it.each(cases)("sends $option = $value on $call", async ({ option, path, value, call }) => {
        const request =
          option === SERVICE_TIER_OPTION
            ? await send(providerUnderTest, call, model, undefined, value as LLMServiceTier)
            : await send(providerUnderTest, call, model, withOption({}, path, value))

        expect(providerUnderTest.locations[option]?.(request)).toEqual(value)
        expect(warningCollector.warnings).toEqual([])
      })

      if (leaves.some((leaf) => leaf.path.join(".") === SERVICE_TIER_OPTION)) {
        it.each(
          CALLS,
        )("leaves out a service tier left in the stored options on %s", async (call) => {
          const storedTier = withOption({}, SERVICE_TIER_OPTION.split("."), "priority")
          const request = await send(providerUnderTest, call, model, storedTier)

          expect(providerUnderTest.locations[SERVICE_TIER_OPTION]?.(request)).toBeUndefined()
          expect(warningCollector.warnings).toEqual([])
        })
      }

      if (!leaves.some((leaf) => leaf.path.join(".") === "temperature")) {
        it.each(CALLS)("leaves out a temperature the model no longer takes on %s", async (call) => {
          const request = await send(providerUnderTest, call, model, { temperature: 0.4 })

          expect(providerUnderTest.locations.temperature?.(request)).toBeUndefined()
          expect(warningCollector.warnings).toEqual([])
        })
      }
    })
  })
})
