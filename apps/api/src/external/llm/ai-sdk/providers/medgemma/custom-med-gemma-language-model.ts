import {
  APICallError,
  type LanguageModelV3,
  type LanguageModelV3CallOptions,
  type LanguageModelV3Content,
  type LanguageModelV3FinishReason,
  type LanguageModelV3GenerateResult,
  type LanguageModelV3Message,
  type LanguageModelV3Prompt,
  type LanguageModelV3StreamPart,
  type LanguageModelV3StreamResult,
  type LanguageModelV3ToolResultOutput,
  type LanguageModelV3Usage,
  type SharedV3Warning,
} from "@ai-sdk/provider"
import { NotImplementedException } from "@nestjs/common"
import { type Span, SpanStatusCode, trace } from "@opentelemetry/api"
import type { JSONSchema7 } from "ai"
import { z } from "zod"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { castToolInputParameters, objectToRecord } from "@/common/zod-helper"

export class CustomMedGemmaLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = "v3"
  readonly provider: string
  readonly modelId: string
  readonly baseUrl: string
  readonly apiKey: string
  /** The fetch the provider picked for the call (with extended timeouts for a long one). */
  private readonly fetch: typeof globalThis.fetch

  constructor({
    baseUrl,
    config,
    apiKey,
    fetch = (input, init) => globalThis.fetch(input, init),
  }: {
    baseUrl: string
    config: LLMConfig
    apiKey: string
    fetch?: typeof globalThis.fetch
  }) {
    this.baseUrl = new URL("v1", baseUrl).toString()
    this.apiKey = apiKey
    this.fetch = fetch
    this.provider = "CustomMedgemma"
    this.modelId = config.model
  }

  // Image URLs are passed through to the vLLM endpoint, which fetches them
  // server-side. Restricted to GCS signed urls, the only image urls we
  // generate (defense in depth against SSRF via injected URLs). Anything else
  // falls back to the AI SDK downloading the bytes and inlining base64 below.
  readonly supportedUrls = { "image/*": [/^https:\/\/storage\.googleapis\.com\/.+/] }

  /**
   * A structured output, against the schema of `responseFormat`. The MedGemma
   * provider routes here the structured output calls, and the repair and the
   * recovery of a chat turn with tools.
   */
  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    return await this.doGenerateForGenerateStructuredOutput(options)
  }

  async doGenerateForGenerateStructuredOutput(
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3GenerateResult> {
    const warnings: SharedV3Warning[] = []
    const input = await this.extractPromptContentsAsInput(options.prompt)

    const responseSchema =
      options.responseFormat?.type === "json" ? options.responseFormat?.schema : undefined
    if (!responseSchema)
      throw new NotImplementedException(
        "DEV - schema should be specified when calling generateStructuredOutput",
      )

    // A copy without `$schema` and the top-level `additionalProperties`: the
    // caller's schema object stays untouched.
    const {
      $schema: _schemaVersion,
      additionalProperties: _additionalProperties,
      ...schema
    } = responseSchema

    const jsonFormat = {
      type: "json_schema",
      json_schema: {
        name: "OutputFormat",
        schema,
      },
    }

    const url = new URL("v1/chat/completions", this.baseUrl).toString()
    const body = {
      model: this.modelId,
      messages: input,
      temperature: options.temperature,
      max_tokens: options.maxOutputTokens,
      stop: options.stopSequences,
      response_format: jsonFormat,
    }
    const stringifiedBody = JSON.stringify(body)

    const res = await this.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        Connection: "close",
      },
      body: stringifiedBody,
    })
    await this.throwIfFailed({ res, url, body })

    // biome-ignore lint/suspicious/noExplicitAny: external
    const data: any = await res.json()

    const content: LanguageModelV3Content[] = []
    const usage: LanguageModelV3Usage = {
      inputTokens: {
        total: data.usage?.prompt_tokens,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: data.usage?.completion_tokens,
        text: data.usage?.completion_tokens,
        reasoning: undefined,
      },
    }
    let finishReason: LanguageModelV3FinishReason

    if (data.choices && data.choices.length > 0) {
      finishReason = this.toFinishReason(data.choices[0].finish_reason)
      if (data.choices[0].message.content) {
        // Thought-token stripping is handled by the wrapping middleware
        // (see AISDKLLMProviderBase.getLanguageModelWithRawCapture).
        content.push({
          type: "text",
          text: data.choices[0].message.content
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .replace(/'''json/gi, "")
            .replace(/'''/g, "")
            .trim(),
        })
      }
    } else {
      finishReason = { unified: "stop", raw: undefined }
      content.push({
        type: "text",
        text: "invalid output",
      })
    }

    return {
      content,
      finishReason,
      usage,
      request: { body: stringifiedBody },
      response: { body: data },
      warnings,
    }
  }

  private async extractPromptContentsAsInput(prompt: LanguageModelV3Prompt) {
    return await Promise.all(prompt.map((message) => this.toInput(message)))
  }

  private async toInput(message: LanguageModelV3Message) {
    if (typeof message.content === "string") {
      return { role: message.role, content: message.content }
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: custom
      const contents: any[] = []
      for (const value of message.content) {
        switch (value.type) {
          case "text":
            contents.push({
              type: "input_text",
              text: value.text,
            })
            break
          case "tool-call":
            contents.push({
              type: "tool-call",
              id: value.toolCallId,
              name: value.toolName,
              input: castToolInputParameters(objectToRecord(value.input) ?? {}),
            })
            break
          case "tool-result": {
            contents.push({
              type: "tool-result",
              id: value.toolCallId,
              name: value.toolName,
              output: this.toolResultOutputToText(value.output),
            })
            break
          }
          case "file": {
            if (!value.mediaType.startsWith("image/"))
              throw new Error(`MedGemma model cannot process ${value.mediaType} file`)
            if (value.data instanceof URL) {
              contents.push({
                type: "image_url",
                image_url: { url: value.data.toString() },
              })
              break
            }
            // A string is already base64 (the AI SDK's data content).
            const buf =
              typeof value.data === "string"
                ? Buffer.from(value.data, "base64")
                : Buffer.from(value.data)
            // fixme DOO: reduce file size ?
            // const resizedBuffer = await sharp(buf)
            //   .resize({ width: 100, height: 100, fit: "inside", withoutEnlargement: true })
            //   .jpeg({ quality: 60 })
            //   .toBuffer()
            // const base64 = resizedBuffer.toString("base64")
            const base64 = buf.toString("base64")
            contents.push({
              type: "image_url",
              image_url: {
                // url: `data:${value.mediaType};base64,${base64}`,
                url: `data:image/jpeg;base64,${base64}`,
              },
            })
            break
          }
          default:
            throw new NotImplementedException(`DEV - Unsupported type: ${value.type}`)
        }
      }
      return { role: message.role, content: contents }
    }
  }

  /** A chat turn with tools, the only stream the MedGemma provider routes here. */
  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    return await this.doStreamWithTools(options)
  }
  private async formatMessages(prompt: LanguageModelV3Prompt) {
    const messagesFromPrompt = await this.extractPromptContentsAsInput(prompt)

    // biome-ignore lint/suspicious/noExplicitAny: custom messages
    const messages: any[] = []
    for (const msg of messagesFromPrompt) {
      if (msg.role === "system") {
        messages.push({
          role: "system",
          content: `${msg.content}`,
        })
      } else if (msg.role === "tool") {
        //fixme DOO : check if necessary ?
        // biome-ignore lint/suspicious/noExplicitAny: custom
        const resultsText = (msg.content as Array<any>)
          .map((part) => `<tool_result name="${part.name}">${part.output}</tool_result>`)
          .join("\n")
        messages.push({ role: "user", content: resultsText })
      } else if (Array.isArray(msg.content)) {
        // Image parts must reach the request body as OpenAI-style content
        // parts; text-only messages keep the plain-string shape vLLM already
        // handles.
        if (msg.content.some((part) => part.type === "image_url")) {
          const contentParts = msg.content
            .map((part) =>
              part.type === "image_url"
                ? part
                : part.text
                  ? { type: "text", text: part.text }
                  : undefined,
            )
            .filter(Boolean)
          messages.push({ role: msg.role, content: contentParts })
        } else {
          messages.push({
            role: msg.role,
            content: msg.content.map((part) => this.partToText(part)).join(""),
          })
        }
      } else {
        messages.push({ role: msg.role, content: msg.content || "" })
      }
    }
    return messages
  }

  async doStreamWithTools(
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3StreamResult> {
    const responseSchema = z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("answer"),
          content: z.string(),
        })
        .strict(),

      z
        .object({
          type: z.literal("tool"),
          name: z.string(),
          arguments: z.object({}).catchall(z.unknown()),
        })
        .strict(),
    ])
    const schema: JSONSchema7 = {
      type: "object",
      oneOf: [
        {
          type: "object",
          properties: {
            type: { const: "answer" },
            content: { type: "string" },
          },
          required: ["type", "content"],
          additionalProperties: false,
        },
        {
          type: "object",
          properties: {
            type: { const: "tool" },
            name: { type: "string" },
            arguments: {
              type: "object",
              additionalProperties: true,
            },
          },
          required: ["type", "name", "arguments"],
          additionalProperties: false,
        },
      ],
    }

    const formattedMessages = await this.formatMessages(options.prompt)
    const jsonFormat = {
      type: "json_schema",
      json_schema: {
        name: "OutputFormat",
        schema,
      },
    }

    const url = new URL("v1/chat/completions", this.baseUrl).toString()
    const body = {
      model: this.modelId,
      messages: formattedMessages,
      temperature: options.temperature,
      max_tokens: options.maxOutputTokens,
      stop: options.stopSequences,
      response_format: jsonFormat,
      stream: true,
      stream_options: { include_usage: true },
    }
    const stringifiedBody = JSON.stringify(body)

    const res = await this.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        Connection: "close",
      },
      body: stringifiedBody,
    })
    // vLLM answers an error raised before the first token as a plain HTTP
    // error, not as an event of the stream.
    await this.throwIfFailed({ res, url, body })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    let finishReason: LanguageModelV3FinishReason
    let usage: LanguageModelV3Usage

    // Capture the active OTel span at doStream invocation time. The AI SDK
    // sets `ai.streamText.doStream` as the active span here. We need a stable
    // reference because the OTel context isn't preserved into the
    // ReadableStream's `start` callback (it runs later, on consumer pull).
    const otelSpan: Span | undefined = trace.getActiveSpan()

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      // Arrow function, so `this` stays the model.
      start: async (controller) => {
        try {
          let responseBuffer = ""
          let rawFinishReason: string | undefined

          /** Handles one SSE line; true once the turn is complete. */
          const handleLine = (line: string): boolean => {
            const jsonStr = line.replace("data:", "").trim()
            if (jsonStr === "") return false
            if (jsonStr === "[DONE]") {
              const response = responseSchema.safeParse(JSON.parse(responseBuffer))
              if (!response.success) {
                throw new Error("Failed to parse response")
              }

              const id = crypto.randomUUID()

              if (response.data.type === "answer") {
                controller.enqueue({
                  type: "text-start",
                  id,
                })
                controller.enqueue({
                  type: "text-delta",
                  delta: response.data.content,
                  id,
                })
                controller.enqueue({
                  type: "text-end",
                  id,
                })
                finishReason = this.toFinishReason(rawFinishReason)
              } else if (response.data.type === "tool") {
                const toolCallId = crypto.randomUUID()
                controller.enqueue({
                  type: "tool-call",
                  toolCallId,
                  toolName: response.data.name,
                  input: JSON.stringify(response.data.arguments),
                })
                finishReason = { unified: "tool-calls", raw: rawFinishReason }
              }
              controller.enqueue({
                type: "finish",
                finishReason,
                usage: {
                  inputTokens: {
                    // biome-ignore lint/complexity/useLiteralKeys: custom
                    total: usage["prompt_tokens"],
                    noCache: undefined,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: {
                    // biome-ignore lint/complexity/useLiteralKeys: custom
                    total: usage["completion_tokens"],
                    // biome-ignore lint/complexity/useLiteralKeys: custom
                    text: usage["completion_tokens"],
                    reasoning: undefined,
                  },
                },
              })
              return true
            }

            // biome-ignore lint/suspicious/noExplicitAny: custom
            let data: any
            try {
              data = JSON.parse(jsonStr)
            } catch {
              return false
            }

            //check if error returned from llm
            if (
              typeof data === "object" &&
              data !== null &&
              typeof data.error === "object" &&
              data.error !== null &&
              typeof data.error.message === "string" &&
              typeof data.error.type === "string"
            ) {
              throw new Error(`Unexpected LLM error : ${JSON.stringify(data.error)}`)
            }

            if (data.usage) {
              usage = data.usage
            }

            const choice = data.choices?.[0]
            if (!choice) return false
            if (choice.finish_reason) {
              rawFinishReason = choice.finish_reason
            }

            const delta = choice.delta
            if (delta?.content) {
              responseBuffer += delta.content
            }
            return false
          }

          // A network chunk can end in the middle of a line, or of a multi-byte
          // character: only complete lines are handled, the rest waits for the
          // next chunk.
          let pendingText = ""
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            pendingText += decoder.decode(value, { stream: true })
            const lines = pendingText.split("\n")
            pendingText = lines.pop() ?? ""
            for (const line of lines) {
              if (handleLine(line)) return
            }
          }
          pendingText += decoder.decode()
          if (handleLine(pendingText)) return

          // The connection closed without `[DONE]`: finish on the output
          // received when it is a complete answer or tool request (it is
          // checked against the schema), otherwise report the cut.
          if (responseBuffer === "") {
            throw new Error("The stream ended before the model answered")
          }
          handleLine("data: [DONE]")
        } catch (error) {
          const normalized =
            error instanceof Error
              ? error
              : new Error(typeof error === "string" ? error : JSON.stringify(error))
          // Record the exception on the captured doStream span so the trace
          // backend flags the generation as ERROR. recordException emits an event named
          // "exception" with `exception.type` / `exception.message` attributes.
          otelSpan?.recordException(normalized)
          otelSpan?.setStatus({ code: SpanStatusCode.ERROR, message: normalized.message })

          // An Error instance, so the caller reports its message (a plain
          // object would surface as "Unknown error occurred").
          controller.enqueue({ type: "error", error: normalized })
        } finally {
          controller.close()
        }
      },
    })

    return {
      stream,
      request: { body: body as unknown } as { body?: unknown },
      response: { headers: this.headersToRecord(res.headers) } as {
        headers?: Record<string, string>
      },
    }
  }

  /**
   * Throws the AI SDK's API call error for a failed HTTP response, so the
   * error carries its status and body, and the SDK retries it when it is
   * retryable (408, 409, 429, 5xx).
   */
  private async throwIfFailed({
    res,
    url,
    body,
  }: {
    res: Response
    url: string
    body: unknown
  }): Promise<void> {
    if (res.ok) return
    const responseBody = await res.text()
    throw new APICallError({
      message: `MedGemma call failed with status ${res.status}: ${responseBody.slice(0, 500)}`,
      url,
      requestBodyValues: body,
      statusCode: res.status,
      responseHeaders: this.headersToRecord(res.headers),
      responseBody,
    })
  }

  /**
   * The V3 finish reason for the raw one of the chat completions API. A turn
   * that ended without a reason (the answer was complete) counts as a stop.
   */
  private toFinishReason(rawFinishReason: string | undefined): LanguageModelV3FinishReason {
    switch (rawFinishReason) {
      case undefined:
      case "stop":
        return { unified: "stop", raw: rawFinishReason }
      case "length":
        return { unified: "length", raw: rawFinishReason }
      case "content_filter":
        return { unified: "content-filter", raw: rawFinishReason }
      case "tool_calls":
        return { unified: "tool-calls", raw: rawFinishReason }
      default:
        return { unified: "other", raw: rawFinishReason }
    }
  }

  /** The text MedGemma reads for the result of a tool it called. */
  private toolResultOutputToText(output: LanguageModelV3ToolResultOutput): string {
    switch (output.type) {
      case "text":
      case "error-text":
        return output.value
      case "json":
      case "error-json":
        return JSON.stringify(output.value)
      default:
        return JSON.stringify(output)
    }
  }

  /**
   * The text of a history part. A tool call is written back in the JSON format
   * the model uses to request it, so the model sees what it already called.
   */
  // biome-ignore lint/suspicious/noExplicitAny: custom
  private partToText(part: any): string {
    if (part.type === "tool-call") {
      return JSON.stringify({ type: "tool", name: part.name, arguments: part.input })
    }
    return part.text || ""
  }

  headersToRecord(headers: Headers): Record<string, string> {
    const obj: Record<string, string> = {}
    headers.forEach((value, key) => {
      obj[key] = value
    })
    return obj
  }
}
