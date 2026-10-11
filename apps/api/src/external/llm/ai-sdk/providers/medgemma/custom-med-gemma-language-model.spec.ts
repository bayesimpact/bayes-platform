import {
  APICallError,
  type LanguageModelV3CallOptions,
  type LanguageModelV3StreamPart,
} from "@ai-sdk/provider"
import { AgentModel, AgentThinkingLevel } from "@caseai-connect/api-contracts"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { CustomMedGemmaLanguageModel } from "./custom-med-gemma-language-model"

describe("CustomMedGemmaLanguageModel", () => {
  const buildConfig = (): LLMConfig => ({
    model: AgentModel.MedGemma10_27B,
    temperature: 0,
    serviceTier: undefined,
    thinkingLevel: AgentThinkingLevel.Auto,
  })

  const buildModel = () =>
    new CustomMedGemmaLanguageModel({
      baseUrl: "http://medgemma.test",
      apiKey: "k",
      config: buildConfig(),
    })

  const chatCompletionsResponse = (
    body: unknown = {
      choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    },
  ) => new Response(JSON.stringify(body), { status: 200 })

  /** A streamed response whose body arrives as the given network chunks. */
  const sseResponse = (chunks: string[]) => {
    const encoder = new TextEncoder()
    return new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
          controller.close()
        },
      }),
      { status: 200, headers: { "x-request-id": "request-1" } },
    )
  }

  const sseLine = (data: unknown) => `data: ${JSON.stringify(data)}\n`

  /** A streamed response whose body arrives as the given byte chunks. */
  const sseBytesResponse = (chunks: Uint8Array[]) =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk)
          controller.close()
        },
      }),
      { status: 200 },
    )

  /** The SSE body of a turn whose JSON output is `output`, streamed in one delta. */
  const sseTurn = (output: unknown) =>
    sseResponse([
      sseLine({
        choices: [{ delta: { content: JSON.stringify(output) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 12, completion_tokens: 5 },
      }),
      "data: [DONE]\n",
    ])

  const streamingChatCompletionsResponse = () => sseTurn({ type: "answer", content: "ok" })

  const drain = async (stream: ReadableStream<unknown>) => {
    const reader = stream.getReader()
    while (!(await reader.read()).done) {
      // consume the stream so the SSE parsing in `start` completes
    }
  }

  const collect = async (stream: ReadableStream<LanguageModelV3StreamPart>) => {
    const streamParts: LanguageModelV3StreamPart[] = []
    const reader = stream.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return streamParts
      streamParts.push(value)
    }
  }

  const structuredOutputOptions = (
    overrides: Partial<LanguageModelV3CallOptions> = {},
  ): LanguageModelV3CallOptions => ({
    prompt: [{ role: "user", content: [{ type: "text", text: "Give it a title." }] }],
    responseFormat: { type: "json", schema: { type: "object", properties: {} } },
    ...overrides,
  })

  const streamOptions = (
    overrides: Partial<LanguageModelV3CallOptions> = {},
  ): LanguageModelV3CallOptions => ({
    prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
    ...overrides,
  })

  const requestBody = (fetchSpy: jest.SpyInstance) => {
    const [, calledInit] = fetchSpy.mock.calls[0] ?? []
    return JSON.parse(String(calledInit?.body))
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("sends the request through the fetch the provider picked", async () => {
    const globalFetchSpy = jest.spyOn(globalThis, "fetch")
    const fetch = jest.fn().mockResolvedValue(chatCompletionsResponse())

    await new CustomMedGemmaLanguageModel({
      baseUrl: "http://medgemma.test",
      apiKey: "k",
      config: buildConfig(),
      fetch,
    }).doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      responseFormat: { type: "json", schema: { type: "object", properties: {} } },
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(globalFetchSpy).not.toHaveBeenCalled()
  })

  it("passes an https image URL through as an OpenAI-style image_url part", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(chatCompletionsResponse())
    const imageUrl =
      "https://storage.googleapis.com/bucket/org/project/derived/doc/page-1.png?X-Goog-Signature=abc"

    await buildModel().doGenerate({
      prompt: [
        {
          role: "user",
          content: [{ type: "file", mediaType: "image/png", data: new URL(imageUrl) }],
        },
      ],
      responseFormat: { type: "json", schema: { type: "object", properties: {} } },
    })

    const [, calledInit] = fetchSpy.mock.calls[0]!
    const body = JSON.parse(String(calledInit?.body))
    expect(body.messages[0].content).toEqual([{ type: "image_url", image_url: { url: imageUrl } }])
  })

  it("still base64-inlines byte image parts", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(chatCompletionsResponse())

    await buildModel().doGenerate({
      prompt: [
        {
          role: "user",
          content: [{ type: "file", mediaType: "image/png", data: new Uint8Array([1, 2, 3]) }],
        },
      ],
      responseFormat: { type: "json", schema: { type: "object", properties: {} } },
    })

    const [, calledInit] = fetchSpy.mock.calls[0]!
    const body = JSON.parse(String(calledInit?.body))
    const base64 = Buffer.from([1, 2, 3]).toString("base64")
    expect(body.messages[0].content).toEqual([
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
    ])
  })

  it("preserves image parts in the streaming chat path (doStreamWithTools)", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(streamingChatCompletionsResponse())
    const imageUrl =
      "https://storage.googleapis.com/bucket/org/project/derived/doc/page-1.png?X-Goog-Signature=abc"

    const { stream } = await buildModel().doStream({
      prompt: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this document" },
            { type: "file", mediaType: "image/png", data: new URL(imageUrl) },
          ],
        },
      ],
    })
    await drain(stream)

    const [, calledInit] = fetchSpy.mock.calls[0]!
    const body = JSON.parse(String(calledInit?.body))
    expect(body.messages[0].content).toEqual([
      { type: "text", text: "Describe this document" },
      { type: "image_url", image_url: { url: imageUrl } },
    ])
  })

  describe("supportedUrls", () => {
    it("only allows GCS signed urls", () => {
      const allowedPatterns = buildModel().supportedUrls["image/*"]

      const matchesAny = (candidateUrl: string) =>
        allowedPatterns.some((pattern) => pattern.test(candidateUrl))

      expect(matchesAny("https://storage.googleapis.com/bucket/x.png")).toBe(true)
      expect(matchesAny("https://evil.example.com/x.png")).toBe(false)
      expect(matchesAny("http://169.254.169.254/latest")).toBe(false)
    })
  })

  describe("doGenerate", () => {
    it("serves a structured output without any provider option", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(chatCompletionsResponse())

      const result = await buildModel().doGenerate(structuredOutputOptions())

      expect(result.content).toEqual([{ type: "text", text: "{}" }])
    })

    it("requires a schema", async () => {
      await expect(
        buildModel().doGenerate(structuredOutputOptions({ responseFormat: { type: "text" } })),
      ).rejects.toThrow("schema should be specified")
    })

    it("posts the call to the chat completions API with the schema as response format", async () => {
      const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(chatCompletionsResponse())

      await buildModel().doGenerate(
        structuredOutputOptions({
          prompt: [
            { role: "system", content: "You give titles." },
            { role: "user", content: [{ type: "text", text: "Give it a title." }] },
          ],
          temperature: 0.3,
          maxOutputTokens: 200,
          responseFormat: {
            type: "json",
            schema: {
              $schema: "http://json-schema.org/draft-07/schema#",
              type: "object",
              properties: { title: { type: "string" } },
              additionalProperties: false,
            },
          },
        }),
      )

      const [requestUrl, init] = fetchSpy.mock.calls[0] ?? []
      expect(String(requestUrl)).toBe("http://medgemma.test/v1/chat/completions")
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer k")
      expect(requestBody(fetchSpy)).toMatchObject({
        model: AgentModel.MedGemma10_27B,
        temperature: 0.3,
        max_tokens: 200,
        messages: [
          { role: "system", content: "You give titles." },
          { role: "user", content: [{ type: "input_text", text: "Give it a title." }] },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "OutputFormat",
            schema: { type: "object", properties: { title: { type: "string" } } },
          },
        },
      })
    })

    it("returns the text without its code fence, with the token usage", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(
        chatCompletionsResponse({
          choices: [{ message: { content: '```json\n{"title":"Pricing"}\n```' } }],
          usage: { prompt_tokens: 30, completion_tokens: 8 },
        }),
      )

      const result = await buildModel().doGenerate(structuredOutputOptions())

      expect(result.content).toEqual([{ type: "text", text: '{"title":"Pricing"}' }])
      expect(result.usage.inputTokens.total).toBe(30)
      expect(result.usage.outputTokens.total).toBe(8)
    })

    it("reports the finish reason in the V3 shape", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(
        chatCompletionsResponse({
          choices: [{ message: { content: '{"title":"Pri' }, finish_reason: "length" }],
          usage: { prompt_tokens: 30, completion_tokens: 8 },
        }),
      )

      const result = await buildModel().doGenerate(structuredOutputOptions())

      expect(result.finishReason).toEqual({ unified: "length", raw: "length" })
    })

    it("inlines a base64 string image as is", async () => {
      const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(chatCompletionsResponse())
      const base64 = Buffer.from([1, 2, 3]).toString("base64")

      await buildModel().doGenerate(
        structuredOutputOptions({
          prompt: [
            { role: "user", content: [{ type: "file", mediaType: "image/png", data: base64 }] },
          ],
        }),
      )

      expect(requestBody(fetchSpy).messages[0].content).toEqual([
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
      ])
    })

    it("throws a retryable API call error on a server error", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("upstream unavailable", { status: 503 }))

      const error = await buildModel()
        .doGenerate(structuredOutputOptions())
        .catch((caught: unknown) => caught)

      expect(APICallError.isInstance(error)).toBe(true)
      expect(error).toMatchObject({
        statusCode: 503,
        isRetryable: true,
        responseBody: "upstream unavailable",
      })
    })

    it("throws a non-retryable API call error on a bad request", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response('{"error":{"message":"bad schema"}}', { status: 400 }))

      await expect(buildModel().doGenerate(structuredOutputOptions())).rejects.toMatchObject({
        statusCode: 400,
        isRetryable: false,
      })
    })

    it("leaves the caller's schema untouched", async () => {
      const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(chatCompletionsResponse())
      const schema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object" as const,
        properties: { title: { type: "string" as const } },
        additionalProperties: false,
      }

      await buildModel().doGenerate(
        structuredOutputOptions({ responseFormat: { type: "json", schema } }),
      )

      expect(schema).toHaveProperty("$schema")
      expect(schema).toHaveProperty("additionalProperties", false)
      expect(requestBody(fetchSpy).response_format.json_schema.schema).toEqual({
        type: "object",
        properties: { title: { type: "string" } },
      })
    })

    it("reports the token usage in the V3 shape even without content", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(
        chatCompletionsResponse({
          choices: [{ message: { content: "" }, finish_reason: "length" }],
          usage: { prompt_tokens: 30, completion_tokens: 0 },
        }),
      )

      const result = await buildModel().doGenerate(structuredOutputOptions())

      expect(result.usage).toMatchObject({
        inputTokens: { total: 30 },
        outputTokens: { total: 0, text: 0 },
      })
    })

    it("answers 'invalid output' when the response has no choice", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(chatCompletionsResponse({ choices: [] }))

      const result = await buildModel().doGenerate(structuredOutputOptions())

      expect(result.content).toEqual([{ type: "text", text: "invalid output" }])
      expect(result.finishReason).toEqual({ unified: "stop", raw: undefined })
    })

    it("refuses a file that is not an image", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(chatCompletionsResponse())

      await expect(
        buildModel().doGenerate(
          structuredOutputOptions({
            prompt: [
              {
                role: "user",
                content: [{ type: "file", mediaType: "application/pdf", data: "aGVsbG8=" }],
              },
            ],
          }),
        ),
      ).rejects.toThrow("MedGemma model cannot process application/pdf file")
    })

    it("refuses a part type it does not support", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(chatCompletionsResponse())

      await expect(
        buildModel().doGenerate(
          structuredOutputOptions({
            prompt: [{ role: "assistant", content: [{ type: "reasoning", text: "Thinking." }] }],
          }),
        ),
      ).rejects.toThrow("Unsupported type: reasoning")
    })
  })

  describe("doStream", () => {
    it("streams a chat turn without any provider option", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(sseTurn({ type: "answer", content: "ok" }))

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts.at(-1)?.type).toBe("finish")
    })

    it("streams the call with the answer-or-tool JSON format and flattens text messages", async () => {
      const fetchSpy = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(sseTurn({ type: "answer", content: "ok" }))

      const { stream, response } = await buildModel().doStream(
        streamOptions({
          prompt: [
            { role: "system", content: "You answer pricing questions." },
            {
              role: "user",
              content: [
                { type: "text", text: "What does " },
                { type: "text", text: "it cost?" },
              ],
            },
          ],
        }),
      )
      await drain(stream)

      const body = requestBody(fetchSpy)
      expect(body.stream).toBe(true)
      expect(body.response_format.json_schema.name).toBe("OutputFormat")
      expect(body.messages).toEqual([
        { role: "system", content: "You answer pricing questions." },
        { role: "user", content: "What does it cost?" },
      ])
      expect(response?.headers?.["x-request-id"]).toBe("request-1")
    })

    it("turns an answer into a text block, then finishes with the token usage", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(sseTurn({ type: "answer", content: "Our plans start at 10 euros." }))

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts.map((part) => part.type)).toEqual([
        "text-start",
        "text-delta",
        "text-end",
        "finish",
      ])
      expect(streamParts[1]).toMatchObject({ delta: "Our plans start at 10 euros." })
      expect(streamParts[3]).toMatchObject({
        usage: { inputTokens: { total: 12 }, outputTokens: { total: 5, text: 5 } },
      })
    })

    it("turns a tool request into a tool call, then finishes on tool calls", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          sseTurn({ type: "tool", name: "lookup_knowledge_base", arguments: { query: "pricing" } }),
        )

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts.map((part) => part.type)).toEqual(["tool-call", "finish"])
      expect(streamParts[0]).toMatchObject({
        toolName: "lookup_knowledge_base",
        input: JSON.stringify({ query: "pricing" }),
      })
      expect(streamParts[1]).toMatchObject({
        finishReason: { unified: "tool-calls", raw: "stop" },
      })
    })

    it("joins an answer streamed over several deltas", async () => {
      const output = JSON.stringify({ type: "answer", content: "Our plans start at 10 euros." })
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          sseResponse([
            sseLine({ choices: [{ delta: { content: output.slice(0, 20) } }] }),
            sseLine({ choices: [{ delta: { content: output.slice(20) } }] }),
            sseLine({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 5 } }),
            "data: [DONE]\n",
          ]),
        )

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts.find((part) => part.type === "text-delta")).toMatchObject({
        delta: "Our plans start at 10 euros.",
      })
    })

    it("streams its parts without provider metadata", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(sseTurn({ type: "answer", content: "ok" }))

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts.map((part) => part.type)).toEqual([
        "text-start",
        "text-delta",
        "text-end",
        "finish",
      ])
      expect(streamParts.some((part) => "providerMetadata" in part)).toBe(false)
    })

    it("reports an error the model returns in the stream as an Error, without answer text", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          sseResponse([
            sseLine({ error: { message: "context too long", type: "BadRequestError" } }),
            "data: [DONE]\n",
          ]),
        )

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts.map((part) => part.type)).toEqual(["error"])
      const { error } = streamParts[0] as { error: unknown }
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain("context too long")
    })

    it("reports an output that is neither an answer nor a tool request", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(sseTurn({ type: "answer", content: "ok", extra: true }))

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts.at(-1)).toMatchObject({
        type: "error",
        error: { message: "Failed to parse response" },
      })
    })

    it("sends the tools the model called and their results back to it", async () => {
      const fetchSpy = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(sseTurn({ type: "answer", content: "We have 42 plans." }))

      const { stream } = await buildModel().doStream(
        streamOptions({
          prompt: [
            { role: "user", content: [{ type: "text", text: "How many plans?" }] },
            {
              role: "assistant",
              content: [
                {
                  type: "tool-call",
                  toolCallId: "call-1",
                  toolName: "lookup_knowledge_base",
                  input: { query: "plans" },
                },
              ],
            },
            {
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolCallId: "call-1",
                  toolName: "lookup_knowledge_base",
                  output: { type: "json", value: { count: 42 } },
                },
              ],
            },
          ],
        }),
      )
      await drain(stream)

      expect(requestBody(fetchSpy).messages).toEqual([
        { role: "user", content: "How many plans?" },
        {
          role: "assistant",
          content: JSON.stringify({
            type: "tool",
            name: "lookup_knowledge_base",
            arguments: { query: "plans" },
          }),
        },
        {
          role: "user",
          content: '<tool_result name="lookup_knowledge_base">{"count":42}</tool_result>',
        },
      ])
    })

    it("sends a text tool result as is", async () => {
      const fetchSpy = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(sseTurn({ type: "answer", content: "ok" }))

      const { stream } = await buildModel().doStream(
        streamOptions({
          prompt: [
            {
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolCallId: "call-1",
                  toolName: "lookup_knowledge_base",
                  output: { type: "text", value: "No plan found." },
                },
              ],
            },
          ],
        }),
      )
      await drain(stream)

      expect(requestBody(fetchSpy).messages[0].content).toBe(
        '<tool_result name="lookup_knowledge_base">No plan found.</tool_result>',
      )
    })

    it("reads a line split across two network chunks", async () => {
      const line = sseLine({
        choices: [
          {
            delta: {
              content: JSON.stringify({ type: "answer", content: "Our plans start at 10." }),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 5 },
      })
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(sseResponse([line.slice(0, 40), line.slice(40), "data: [DONE]\n"]))

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts.find((part) => part.type === "text-delta")).toMatchObject({
        delta: "Our plans start at 10.",
      })
      expect(streamParts.some((part) => part.type === "error")).toBe(false)
    })

    it("reads an accented character split across two network chunks", async () => {
      const bytes = new TextEncoder().encode(
        `${sseLine({
          choices: [{ delta: { content: JSON.stringify({ type: "answer", content: "Déjà vu" }) } }],
          usage: { prompt_tokens: 12, completion_tokens: 5 },
        })}data: [DONE]\n`,
      )
      // "é" is two bytes in UTF-8: cut between them.
      const accentIndex = bytes.indexOf(0xc3)
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          sseBytesResponse([bytes.slice(0, accentIndex + 1), bytes.slice(accentIndex + 1)]),
        )

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts.find((part) => part.type === "text-delta")).toMatchObject({
        delta: "Déjà vu",
      })
    })

    it("reads the last line even without a final newline", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(
        sseResponse([
          sseLine({
            choices: [{ delta: { content: JSON.stringify({ type: "answer", content: "ok" }) } }],
            usage: { prompt_tokens: 12, completion_tokens: 5 },
          }),
          "data: [DONE]",
        ]),
      )

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts.at(-1)?.type).toBe("finish")
    })

    it("reports the finish reason of an answer in the V3 shape", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(sseTurn({ type: "answer", content: "ok" }))

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts.at(-1)).toMatchObject({
        type: "finish",
        finishReason: { unified: "stop", raw: "stop" },
      })
    })

    it("throws a retryable API call error when the call fails before streaming", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response('{"error":{"message":"engine dead"}}', { status: 500 }))

      await expect(buildModel().doStream(streamOptions())).rejects.toMatchObject({
        statusCode: 500,
        isRetryable: true,
      })
    })

    it("sends no tool parameter, only the response format", async () => {
      const fetchSpy = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(sseTurn({ type: "answer", content: "ok" }))

      const { stream } = await buildModel().doStream(streamOptions())
      await drain(stream)

      const body = requestBody(fetchSpy)
      expect(body).not.toHaveProperty("toolChoice")
      expect(body).not.toHaveProperty("tools")
      expect(body.response_format.type).toBe("json_schema")
    })

    it("finishes on a complete output when the connection closes without [DONE]", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(
        sseResponse([
          sseLine({
            choices: [{ delta: { content: JSON.stringify({ type: "answer", content: "ok" }) } }],
            usage: { prompt_tokens: 12, completion_tokens: 5 },
          }),
        ]),
      )

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts.map((part) => part.type)).toEqual([
        "text-start",
        "text-delta",
        "text-end",
        "finish",
      ])
    })

    it("reports a cut when the connection closes in the middle of the output", async () => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          sseResponse([sseLine({ choices: [{ delta: { content: '{"type":"answer","con' } }] })]),
        )

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts.map((part) => part.type)).toEqual(["error"])
    })

    it("reports a cut when the connection closes before any output", async () => {
      jest.spyOn(globalThis, "fetch").mockResolvedValue(sseResponse([]))

      const { stream } = await buildModel().doStream(streamOptions())
      const streamParts = await collect(stream)

      expect(streamParts).toHaveLength(1)
      expect((streamParts[0] as { error: Error }).error.message).toBe(
        "The stream ended before the model answered",
      )
    })
  })
})
