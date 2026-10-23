import type { JSONSchema7Definition, LanguageModelV3CallOptions } from "@ai-sdk/provider"
import { AgentModel, type AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import { jsonSchema, type ToolSet, tool } from "ai"
import { GoogleAuth } from "google-auth-library"
import { z } from "zod"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { zNullableType } from "@/common/zod-helper"
import { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import type { ModelInfos, ModelOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKVllmProviderBase } from "@/external/llm/ai-sdk/providers/ai-sdk-vllm-provider-base"

jest.mock("google-auth-library", () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({ getClient: jest.fn() })),
}))

const URL_ENV = "VLLM_GEMMA4_26B_URL"
const API_KEY_ENV = "VLLM_GEMMA4_26B_APIKEY" // gitleaks:allow (the name of the variable, not a key)

class TestVllmProvider extends AISDKVllmProviderBase<AgentProvider.Gemma> {
  protected readonly providerName = "Test Provider"
  // The tests never read the model options.
  protected readonly modelOptions = {} as Record<AgentModelOf<AgentProvider.Gemma>, ModelOptions>
  protected readonly modelInfos = {} as Record<AgentModelOf<AgentProvider.Gemma>, ModelInfos>

  getAgentProvider(): AgentProvider.Gemma {
    return AgentProvider.Gemma
  }

  toolsForPrompt(tools: ToolSet): string[] | undefined {
    return this.describeToolsForPrompt(tools)
  }
  argumentStringFor(schema: JSONSchema7Definition): string {
    return this.jsonSchemaToArgumentString(schema)
  }
  modelEnvSettingsFor(model: string): { url: string; apiKey: string } {
    return this.getModelEnvSettings(model)
  }
  authFor(): Pick<GoogleAuth, "getClient"> {
    return this.auth
  }
}

class TestVllmProviderWithFakeAuth extends TestVllmProvider {
  protected get auth(): Pick<GoogleAuth, "getClient"> {
    return {
      getClient: async () => ({ getAccessToken: async () => ({ token: "google-access-token" }) }),
    } as unknown as Pick<GoogleAuth, "getClient">
  }
}

const config: LLMConfig = {
  model: AgentModel.Gemma4_26B,
  modelOptions: { temperature: 0 },
  systemPrompt: "You are a helpful assistant.",
  serviceTier: undefined,
}

function chatCompletionResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      id: "completion-1",
      object: "chat.completion",
      created: 0,
      model: AgentModel.Gemma4_26B,
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  )
}

describe("AISDKVllmProviderBase", () => {
  const savedEnv = { url: process.env[URL_ENV], apiKey: process.env[API_KEY_ENV] }
  let provider: TestVllmProvider

  beforeEach(() => {
    process.env[URL_ENV] = "https://gemma.example.com/v1"
    process.env[API_KEY_ENV] = "vllm-api-key"
    provider = new TestVllmProvider()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.mocked(GoogleAuth).mockClear()
    for (const [name, value] of [
      [URL_ENV, savedEnv.url],
      [API_KEY_ENV, savedEnv.apiKey],
    ] as const) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  })

  describe("getModelEnvSettings", () => {
    it("reads the URL and the API key of the model", () => {
      expect(provider.modelEnvSettingsFor(AgentModel.Gemma4_26B)).toEqual({
        url: "https://gemma.example.com/v1",
        apiKey: "vllm-api-key",
      })
    })

    it("names the missing URL variable", () => {
      delete process.env[URL_ENV]
      expect(() => provider.modelEnvSettingsFor(AgentModel.Gemma4_26B)).toThrow(
        `Missing environment variable: ${URL_ENV}`,
      )
    })

    it("names the missing API key variable", () => {
      delete process.env[API_KEY_ENV]
      expect(() => provider.modelEnvSettingsFor(AgentModel.Gemma4_26B)).toThrow(
        `Missing environment variable: ${API_KEY_ENV}`,
      )
    })

    it("rejects a model outside the catalog", () => {
      expect(() => provider.modelEnvSettingsFor("unknown-model")).toThrow(
        "Unknown model: unknown-model",
      )
    })
  })

  describe("telemetry metadata", () => {
    it("names the provider", () => {
      expect(provider.getProviderMetadata()).toEqual({ name: AgentProvider.Gemma })
    })

    it("names the model", () => {
      expect(provider.getModelMetadata(config)).toEqual({ name: AgentModel.Gemma4_26B })
    })
  })

  describe("getLanguageModel", () => {
    it("calls the OpenAI-compatible chat API of the model with a Google access token", async () => {
      const provider = new TestVllmProviderWithFakeAuth()
      const fetchSpy = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(chatCompletionResponse("Hello, how can I help?"))
      const model = provider.getLanguageModel({ config, callOrigin: CallOrigin.generateText })

      const result = await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      } as LanguageModelV3CallOptions)

      expect(result.content).toEqual([{ type: "text", text: "Hello, how can I help?" }])
      const [requestUrl, init] = fetchSpy.mock.calls[0] ?? []
      expect(String(requestUrl)).toBe("https://gemma.example.com/v1/chat/completions")
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer google-access-token")
    })

    it("names the model after the provider", () => {
      const model = provider.getLanguageModel({ config, callOrigin: CallOrigin.generateText })
      expect(model.provider).toContain("Test Provider")
      expect(model.modelId).toBe(AgentModel.Gemma4_26B)
    })
  })

  describe("auth", () => {
    it("creates the Google client on first use only, then reuses it", () => {
      expect(GoogleAuth).not.toHaveBeenCalled()

      const first = provider.authFor()
      const second = provider.authFor()

      expect(GoogleAuth).toHaveBeenCalledTimes(1)
      expect(second).toBe(first)
    })
  })

  describe("describeToolsForPrompt", () => {
    it("describes a zod tool exactly as before (no prompt change for existing tools)", () => {
      const tools = {
        test: tool({
          description: "A test tool",
          inputSchema: z.object({
            stringVal: zNullableType(z.string(), "String"),
            boolVal: zNullableType(z.boolean(), "Boolean"),
            intVal: zNullableType(z.int(), "Int"),
            numberVal: zNullableType(z.number(), "Number"),
          }),
        }),
      }

      expect(provider.toolsForPrompt(tools)).toEqual([
        "- test: A test tool\n  Parameters: { stringVal: string | null; boolVal: boolean | null; intVal: number | null; numberVal: number | null }",
      ])
    })

    it("describes nested objects, optional and default fields, enums and arrays as before", () => {
      const tools = {
        test: tool({
          description: "A test tool",
          inputSchema: z.object({
            stringVal: zNullableType(z.string(), "String"),
            objVal: z.object({ boolVal: zNullableType(z.boolean(), "Boolean") }),
            optionalVal: z.string().optional(),
            language: z.string().default("fr"),
            severity: z.enum(["low", "high"]),
            tags: z.array(z.string()),
            items: z.array(z.object({ title: z.string() })),
          }),
        }),
      }

      expect(provider.toolsForPrompt(tools)?.[0]).toBe(
        "- test: A test tool\n  Parameters: { stringVal: string | null; objVal: { boolVal: boolean | null }; optionalVal: string | null; language: string (default: 'fr'); severity: 'low' | 'high'; tags: string[]; items: Array<{ title: string }> }",
      )
    })

    it("describes the parameters of an MCP tool declared as JSON Schema", () => {
      const tools = {
        search_documents: tool({
          description: "Searches the documents.",
          inputSchema: jsonSchema({
            type: "object",
            properties: { query: { type: "string" }, limit: { type: "integer" } },
            required: ["query"],
          }),
        }),
      }

      expect(provider.toolsForPrompt(tools)).toEqual([
        "- search_documents: Searches the documents.\n  Parameters: { query: string; limit: number | null }",
      ])
    })

    it("is undefined without tools", () => {
      expect(provider.toolsForPrompt({})).toBeUndefined()
    })
  })

  describe("jsonSchemaToArgumentString", () => {
    it.each<[string, JSONSchema7Definition, string]>([
      ["a nullable type list", { type: ["string", "null"] }, "string | null"],
      ["a one-of union", { oneOf: [{ type: "number" }, { type: "null" }] }, "number | null"],
      ["a constant", { const: "summary" }, "'summary'"],
      ["a free-form object", { type: "object" }, "object"],
      ["an object without properties", { type: "object", properties: {} }, "{  }"],
      ["a boolean schema", true, "unknown"],
    ])("renders %s", (_case, schema, expected) => {
      expect(provider.argumentStringFor(schema)).toBe(expected)
    })
  })
})
