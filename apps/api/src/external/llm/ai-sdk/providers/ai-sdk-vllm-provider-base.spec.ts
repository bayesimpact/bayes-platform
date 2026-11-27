import { createServer, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import type { JSONSchema7Definition, LanguageModelV3CallOptions } from "@ai-sdk/provider"
import { AgentModel, type AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import { jsonSchema, type ToolSet, tool } from "ai"
import { z } from "zod"
import type { LLMCallContext, LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { zNullableType } from "@/common/zod-helper"
import { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import type { ModelInfos, ModelOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKVllmProviderBase } from "@/external/llm/ai-sdk/providers/ai-sdk-vllm-provider-base"
import { ALLOW_INSECURE_LOCAL_MODEL_ENDPOINTS_ENV } from "@/external/llm/workspace-models/model-endpoint-url"

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
  endpointFor(callContext: LLMCallContext) {
    return this.resolveEndpoint({ config, callContext })
  }
}

const config: LLMConfig = {
  model: AgentModel.Gemma4_26B,
  modelOptions: { temperature: 0 },
  systemPrompt: "You are a helpful assistant.",
  serviceTier: undefined,
}

const callContext = {
  traceId: "trace-1",
  organizationId: "organization-1",
  projectId: "project-1",
  agentId: "agent-1",
  revision: 2,
  agentSessionId: "session-1",
  currentTurn: 1,
} as LLMCallContext

function chatCompletionBody(content: string): string {
  return JSON.stringify({
    id: "completion-1",
    object: "chat.completion",
    created: 0,
    model: AgentModel.Gemma4_26B,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  })
}

const userPrompt = {
  prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
} as LanguageModelV3CallOptions

/** The messages of an error and of its causes, to tell a refusal from another failure. */
function errorMessages(error: unknown): string {
  const messages: string[] = []
  for (let current = error; current instanceof Error; current = current.cause) {
    messages.push(current.message)
  }
  return messages.join(" <- ")
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
    for (const [name, value] of [
      [URL_ENV, savedEnv.url],
      [API_KEY_ENV, savedEnv.apiKey],
    ] as const) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  })

  describe("resolveEndpoint", () => {
    it("has no endpoint without a resolver", async () => {
      expect(await provider.endpointFor(callContext)).toBeUndefined()
    })

    it("asks the resolver with the call context and the model of the call", async () => {
      const endpoint = {
        url: "https://other-server.example.com/v1",
        apiKey: null,
        servedModelName: null,
      }
      const resolveEndpoint = jest.fn().mockResolvedValue(endpoint)
      const providerWithResolver = new TestVllmProvider({ resolveEndpoint })

      expect(await providerWithResolver.endpointFor(callContext)).toEqual(endpoint)
      expect(resolveEndpoint).toHaveBeenCalledWith({ callContext, model: AgentModel.Gemma4_26B })
    })

    it("keeps the environment variables when the resolver has nothing", async () => {
      const providerWithResolver = new TestVllmProvider({
        resolveEndpoint: jest.fn().mockResolvedValue(null),
      })

      expect(await providerWithResolver.endpointFor(callContext)).toBeUndefined()
    })
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
    it("calls the OpenAI-compatible chat API of the model with its API key", async () => {
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
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer vllm-api-key")
    })

    it("names the model after the provider", () => {
      const model = provider.getLanguageModel({ config, callOrigin: CallOrigin.generateText })
      expect(model.provider).toContain("Test Provider")
      expect(model.modelId).toBe(AgentModel.Gemma4_26B)
    })
  })

  describe("the server of a workspace", () => {
    type ReceivedRequest = { path: string; authorization: string | undefined; model: unknown }
    let server: Server
    let serverUrl: string
    let receivedRequests: ReceivedRequest[]
    let answer: (path: string, response: ServerResponse) => void
    const savedAllowPrivate = process.env[ALLOW_INSECURE_LOCAL_MODEL_ENDPOINTS_ENV]

    beforeAll(async () => {
      server = createServer((request, response) => {
        let body = ""
        request.on("data", (chunk) => {
          body += chunk
        })
        request.on("end", () => {
          receivedRequests.push({
            path: request.url ?? "",
            authorization: request.headers.authorization,
            model: body ? JSON.parse(body).model : undefined,
          })
          answer(request.url ?? "", response)
        })
      })
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
      serverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    })

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    })

    beforeEach(() => {
      receivedRequests = []
      answer = (_path, response) => {
        response.writeHead(200, { "content-type": "application/json" })
        response.end(chatCompletionBody("Hello"))
      }
      // The test server listens on the loopback, which only a developer's machine allows.
      process.env[ALLOW_INSECURE_LOCAL_MODEL_ENDPOINTS_ENV] = "true"
    })

    afterEach(() => {
      if (savedAllowPrivate === undefined)
        delete process.env[ALLOW_INSECURE_LOCAL_MODEL_ENDPOINTS_ENV]
      else process.env[ALLOW_INSECURE_LOCAL_MODEL_ENDPOINTS_ENV] = savedAllowPrivate
    })

    const callServer = (
      endpoint: { url: string; apiKey?: string | null; servedModelName?: string | null },
      callConfig: LLMConfig = config,
    ) =>
      Promise.resolve(
        provider
          .getLanguageModel({
            config: callConfig,
            callOrigin: CallOrigin.generateText,
            endpoint: { apiKey: null, servedModelName: null, ...endpoint },
          })
          .doGenerate(userPrompt),
      )

    it("calls the server of the endpoint with its key and its served name", async () => {
      const result = await callServer({
        url: `${serverUrl}/v1`,
        apiKey: "endpoint-key",
        servedModelName: "gemma-on-new-server",
      })

      expect(result.content).toEqual([{ type: "text", text: "Hello" }])
      expect(receivedRequests).toEqual([
        {
          path: "/v1/chat/completions",
          authorization: "Bearer endpoint-key",
          model: "gemma-on-new-server",
        },
      ])
    })

    it("does not send the key of the environment to another server", async () => {
      await callServer({ url: `${serverUrl}/v1` })

      expect(receivedRequests[0]?.authorization).toBe("Bearer <not used>")
    })

    it("sends the key of the environment to the server of the environment", async () => {
      process.env[URL_ENV] = `${serverUrl}/v1`

      await callServer({ url: `${serverUrl}/v1`, servedModelName: "gemma-other-name" })

      expect(receivedRequests[0]?.authorization).toBe("Bearer vllm-api-key")
    })

    it("fails on a redirect and does not follow it", async () => {
      answer = (path, response) => {
        if (path === "/elsewhere/chat/completions") {
          response.writeHead(200, { "content-type": "application/json" })
          response.end(chatCompletionBody("Followed"))
          return
        }
        response.writeHead(307, { location: `${serverUrl}/elsewhere/chat/completions` })
        response.end()
      }

      await expect(callServer({ url: `${serverUrl}/v1` })).rejects.toThrow()
      expect(receivedRequests.map((request) => request.path)).toEqual(["/v1/chat/completions"])
    })

    it("refuses to connect to a name that resolves to a private address", async () => {
      delete process.env[ALLOW_INSECURE_LOCAL_MODEL_ENDPOINTS_ENV]

      for (const callConfig of [config, { ...config, useExtendedTimeouts: true }]) {
        const error = await callServer(
          { url: `http://localhost:${new URL(serverUrl).port}/v1` },
          callConfig,
        ).catch((caught: unknown) => caught)
        expect(errorMessages(error)).toContain("is not a public address")
      }
      expect(receivedRequests).toEqual([])
    })

    it("refuses to call a private address", async () => {
      delete process.env[ALLOW_INSECURE_LOCAL_MODEL_ENDPOINTS_ENV]

      const error = await callServer({ url: `${serverUrl}/v1` }).catch((caught: unknown) => caught)

      expect(errorMessages(error)).toContain("is not a public address")
      expect(receivedRequests).toEqual([])
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
