import type { AgentModel, AgentProvider } from "@caseai-connect/api-contracts"
import { AgentModelToAgentProvider } from "@caseai-connect/api-contracts"
import { z } from "zod"
import type { LLMConfig, LLMMetadata } from "@/common/interfaces/llm-provider.interface"
import type { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"

/**
 * Harness of the AI SDK non-regression suite: the real providers and the real
 * AI SDK run, only the network is replaced. Every HTTP request the SDK sends is
 * recorded, and answered with a response written in the format of the model's
 * API (Gemini for Vertex, OpenAI for vLLM). A new SDK version that changes the
 * request (a dropped option, a renamed field) or reads the response another
 * way fails here, without calling any model.
 */

/** One HTTP request the AI SDK sent. */
export type CapturedRequest = {
  url: string
  method: string
  headers: Record<string, string>
  /** The JSON body, parsed. */
  body: Record<string, unknown>
}

/** One AI SDK warning (an option it ignored, a setting the model does not take). */
export type CapturedWarning = { type: string; message?: string; feature?: string; details?: string }

/**
 * Replaces the global fetch, which every provider reaches its model through
 * (`defaultFetch` reads it at call time). Responses are served in order, one
 * per request; a request with no response left fails the test.
 */
export function installFakeFetch() {
  const requests: CapturedRequest[] = []
  const responses: Response[] = []
  const fetchSpy = jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString()
      requests.push({
        url,
        method: init?.method ?? "GET",
        headers: Object.fromEntries(
          [...new Headers(init?.headers).entries()].map(([key, value]) => [
            key.toLowerCase(),
            value,
          ]),
        ),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : {},
      })
      const response = responses.shift()
      if (!response) throw new Error(`No fake response left for ${url}`)
      return response
    })
  return {
    requests,
    /** Queues the responses of the next requests, in order. */
    respondWith(...next: Response[]) {
      responses.push(...next)
    },
    /** The single request of the call, failing when there were several. */
    onlyRequest(): CapturedRequest {
      expect(requests).toHaveLength(1)
      return requests[0] as CapturedRequest
    },
    restore() {
      fetchSpy.mockRestore()
    },
  }
}

/**
 * Collects the AI SDK warnings instead of logging them: an option the SDK
 * accepted but does not send shows up here.
 */
export function installWarningCollector() {
  const warnings: CapturedWarning[] = []
  const globals = globalThis as { AI_SDK_LOG_WARNINGS?: unknown }
  const previous = globals.AI_SDK_LOG_WARNINGS
  globals.AI_SDK_LOG_WARNINGS = ({ warnings: logged }: { warnings: CapturedWarning[] }) => {
    warnings.push(...logged)
  }
  return {
    warnings,
    restore() {
      globals.AI_SDK_LOG_WARNINGS = previous
    },
  }
}

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })

const sseResponse = (events: unknown[], { done = false }: { done?: boolean } = {}) =>
  new Response(
    [
      ...events.map((event) => `data: ${JSON.stringify(event)}\n\n`),
      done ? "data: [DONE]\n\n" : "",
    ].join(""),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  )

/** Responses of the Gemini API (`generateContent`, `streamGenerateContent?alt=sse`). */
export const gemini = {
  usage: { promptTokenCount: 11, candidatesTokenCount: 7, totalTokenCount: 18 },

  text(text: string, { thought }: { thought?: string } = {}) {
    return jsonResponse({
      candidates: [
        {
          content: {
            role: "model",
            parts: [...(thought ? [{ text: thought, thought: true }] : []), { text }],
          },
          finishReason: "STOP",
        },
      ],
      usageMetadata: gemini.usage,
    })
  },

  /** The text in several chunks, the last one carrying the finish reason and the usage. */
  streamedText(chunks: string[], { thought }: { thought?: string } = {}) {
    return sseResponse([
      ...(thought
        ? [
            {
              candidates: [
                { content: { role: "model", parts: [{ text: thought, thought: true }] } },
              ],
            },
          ]
        : []),
      ...chunks.map((text, index) => ({
        candidates: [
          {
            content: { role: "model", parts: [{ text }] },
            ...(index === chunks.length - 1 ? { finishReason: "STOP" } : {}),
          },
        ],
        ...(index === chunks.length - 1 ? { usageMetadata: gemini.usage } : {}),
      })),
    ])
  },

  /** A tool call with the thought signature Gemini 3 attaches to it, to be replayed next step. */
  streamedToolCall(name: string, args: Record<string, unknown>, thoughtSignature = "signature-1") {
    return sseResponse([
      {
        candidates: [
          {
            content: { role: "model", parts: [{ functionCall: { name, args }, thoughtSignature }] },
            finishReason: "STOP",
          },
        ],
        usageMetadata: gemini.usage,
      },
    ])
  },
}

/** Responses of the OpenAI chat completions API, as vLLM serves it. */
export const openAiChat = {
  usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },

  text(text: string) {
    return jsonResponse({
      id: "chatcmpl-1",
      object: "chat.completion",
      created: 1,
      model: "vllm-model",
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
      usage: openAiChat.usage,
    })
  },

  streamedText(chunks: string[]) {
    const chunk = (delta: Record<string, unknown>, finishReason: string | null) => ({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 1,
      model: "vllm-model",
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    })
    return sseResponse(
      [
        ...chunks.map((content, index) =>
          chunk(index === 0 ? { role: "assistant", content } : { content }, null),
        ),
        { ...chunk({}, "stop"), usage: openAiChat.usage },
      ],
      { done: true },
    )
  },

  streamedToolCall(name: string, args: Record<string, unknown>) {
    return sseResponse(
      [
        {
          id: "chatcmpl-1",
          object: "chat.completion.chunk",
          created: 1,
          model: "vllm-model",
          choices: [
            {
              index: 0,
              delta: {
                role: "assistant",
                tool_calls: [
                  {
                    index: 0,
                    id: "call_1",
                    type: "function",
                    function: { name, arguments: JSON.stringify(args) },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: "chatcmpl-1",
          object: "chat.completion.chunk",
          created: 1,
          model: "vllm-model",
          choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
          usage: openAiChat.usage,
        },
      ],
      { done: true },
    )
  },
}

/** Responses of the OpenAI Responses API, as vLLM serves it (MedGemma's streamed chat). */
export const openAiResponses = {
  streamedText(chunks: string[]) {
    const item = { type: "message", id: "msg_1", role: "assistant" }
    return sseResponse([
      { type: "response.created", response: { id: "resp_1", created_at: 1, model: "vllm-model" } },
      { type: "response.output_item.added", output_index: 0, item: { ...item, content: [] } },
      ...chunks.map((delta) => ({
        type: "response.output_text.delta",
        item_id: "msg_1",
        output_index: 0,
        content_index: 0,
        delta,
      })),
      {
        type: "response.output_item.done",
        output_index: 0,
        item: {
          ...item,
          status: "completed",
          content: [{ type: "output_text", text: chunks.join(""), annotations: [] }],
        },
      },
      {
        type: "response.completed",
        response: { usage: { input_tokens: 11, output_tokens: 7 } },
      },
    ])
  },
}

/** Responses of the Open Responses API (MedGemma's plain text generation). */
export const openResponses = {
  text(text: string) {
    return jsonResponse({
      id: "resp_1",
      object: "response",
      created_at: 1,
      model: "vllm-model",
      status: "completed",
      output: [
        {
          type: "message",
          id: "msg_1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text, annotations: [] }],
        },
      ],
      usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 },
    })
  },
}

export const metadata: LLMMetadata = {
  traceId: "trace-1",
  organizationId: "organization-1",
  projectId: "project-1",
  agentId: "agent-1",
  agentSessionId: "session-1",
  currentTurn: 1,
  revision: 1,
  tags: {},
}

export function configFor(
  model: AgentModel,
  overrides: Partial<Omit<LLMConfig, "model">> = {},
): LLMConfig {
  return { model, systemPrompt: "You are a helpful assistant.", ...overrides } as LLMConfig
}

/** The models a provider serves, from the contracts' catalog. */
export function modelsOf(provider: AgentProvider): AgentModel[] {
  return (Object.entries(AgentModelToAgentProvider) as [AgentModel, AgentProvider][])
    .filter(([, modelProvider]) => modelProvider === provider)
    .map(([model]) => model)
}

/** A leaf of a model's options schema: where it sits, and the values worth sending. */
export type ModelOptionLeaf = { path: string[]; samples: unknown[] }

type JsonSchemaNode = {
  type?: string
  enum?: unknown[]
  minimum?: number
  maximum?: number
  properties?: Record<string, JsonSchemaNode>
}

/**
 * Every option a model takes, read from its schema, with the values to send:
 * each value of an enum, both booleans, the bounds and a middle of a number.
 * A new option declared in a provider shows up here without any change.
 */
export function modelOptionLeaves(
  provider: Pick<AISDKLLMProviderBase, "getModelOptionsSchema">,
  model: AgentModel,
): ModelOptionLeaf[] {
  const schema = z.toJSONSchema(provider.getModelOptionsSchema(model)) as JsonSchemaNode
  const leaves: ModelOptionLeaf[] = []
  const walk = (node: JsonSchemaNode, path: string[]) => {
    if (node.properties) {
      for (const [key, child] of Object.entries(node.properties)) walk(child, [...path, key])
      return
    }
    if (node.enum) leaves.push({ path, samples: node.enum })
    else if (node.type === "boolean") leaves.push({ path, samples: [true, false] })
    else if (node.type === "number" || node.type === "integer") {
      const minimum = node.minimum ?? 0
      const maximum = node.maximum ?? 1
      leaves.push({ path, samples: [minimum, Math.round((minimum + maximum) * 37) / 100, maximum] })
    } else leaves.push({ path, samples: [] })
  }
  walk(schema, [])
  return leaves
}

/** `options` with `value` set at `path`, copied. */
export function withOption(
  options: Record<string, unknown>,
  path: string[],
  value: unknown,
): Record<string, unknown> {
  const [key, ...rest] = path as [string, ...string[]]
  if (rest.length === 0) return { ...options, [key]: value }
  const child = (options[key] ?? {}) as Record<string, unknown>
  return { ...options, [key]: withOption(child, rest, value) }
}

/** The value at `path` of `options`, undefined when absent. */
export function readOption(options: Record<string, unknown>, path: string[]): unknown {
  return path.reduce<unknown>(
    (node, key) =>
      typeof node === "object" && node !== null
        ? (node as Record<string, unknown>)[key]
        : undefined,
    options,
  )
}

/** Drains a streamed chat answer into its text. */
export async function collect(stream: AsyncGenerator<string, void, unknown>): Promise<string> {
  let text = ""
  for await (const chunk of stream) text += chunk
  return text
}
