import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Usage,
  SharedV3ProviderMetadata,
  SharedV3Warning,
} from "@ai-sdk/provider"
import { NotImplementedException } from "@nestjs/common"
import type { JSONSchema7 } from "ai"
import { z } from "zod"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { castToolInputParameters, objectToRecord } from "@/common/zod-helper"
import { CallOrigin, extractThoughtAndAnswer } from "@/external/llm/ai-sdk-llm-provider-base"

class LanguageModelV3Prompt {}

export class CustomMedGemmaLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = "v3"
  readonly provider: string
  readonly modelId: string
  readonly baseUrl: string
  readonly apiKey: string

  constructor({ baseUrl, config, apiKey }: { baseUrl: string; config: LLMConfig; apiKey: string }) {
    this.baseUrl = new URL("v1", baseUrl).toString()
    this.apiKey = apiKey
    this.provider = "CustomMedgemma"
    this.modelId = config.model
  }

  //required for LanguageModelV3 implementation
  get supportedUrls() {
    return {
      "image/*": [/^https:\/\/example\.com\/images\/.*/],
    }
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const callOrigin = options.providerOptions?.custom?.callOrigin
    if (!callOrigin)
      throw new NotImplementedException(
        "DEV - callOrigin is not specified in the options.providerOptions.custom",
      )
    switch (callOrigin) {
      case CallOrigin.generateStructuredOutput:
        return await this.doGenerateForGenerateStructuredOutput(options)
      default:
        throw new NotImplementedException(
          `DEV - doGenerate is not implemented for callOrigin = ${callOrigin}}`,
        )
    }
  }

  async doGenerateForGenerateStructuredOutput(
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3GenerateResult> {
    const warnings: SharedV3Warning[] = []
    const input = await this.extractPromptContentsAsInput(options.prompt)

    const schema =
      options.responseFormat?.type === "json" ? options.responseFormat?.schema : undefined
    if (!schema)
      throw new NotImplementedException(
        "DEV - schema should be specified when calling generateStructuredOutput",
      )

    delete schema.$schema
    delete schema.additionalProperties

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
      tools: undefined,
      ...(jsonFormat ? { response_format: jsonFormat } : undefined),
    }
    const stringifiedBody = JSON.stringify(body)

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        Connection: "close",
      },
      body: stringifiedBody,
    })

    // biome-ignore lint/suspicious/noExplicitAny: external
    const data: any = await res.json()

    const content: LanguageModelV3Content[] = []
    let usage: LanguageModelV3Usage = data.usage ?? null
    let finishReason: LanguageModelV3FinishReason

    if (data.choices && data.choices.length > 0) {
      finishReason = data.choices?.[0]?.finish_reason ?? null
      if (data.choices[0].message.content) {
        const { answer } = extractThoughtAndAnswer(data.choices[0].message.content)
        content.push({
          type: "text",
          text: answer
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .replace(/'''json/gi, "")
            .replace(/'''/g, "")
            .trim(),
        })
        usage = {
          inputTokens: {
            total: data.usage.prompt_tokens,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: data.usage.completion_tokens,
            text: data.usage.completion_tokens,
            reasoning: undefined,
          },
        }
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
    return await Promise.all(
      (prompt as Array<{ role: string; content: string | LanguageModelV3Content[] }>).map((p) =>
        this.toInput(p),
      ),
    )
  }

  private async toInput(prompt: { role: string; content: string | LanguageModelV3Content[] }) {
    if (typeof prompt.content === "string") {
      return { role: prompt.role, content: prompt.content }
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: custom
      const contents: any[] = []
      for (const value of prompt.content) {
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
              output: JSON.stringify(value.result),
            })
            break
          }
          case "file": {
            if (!value.mediaType.startsWith("image/"))
              throw new NotImplementedException(`DEV - Unsupported media type: ${value.mediaType}`)
            const buf = Buffer.from(value.data)
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
      return { role: prompt.role, content: contents }
    }
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    const callOrigin = options.providerOptions?.custom?.callOrigin
    if (!callOrigin)
      throw new NotImplementedException(
        "DEV - callOrigin is not specified in the options.providerOptions.custom",
      )
    switch (callOrigin) {
      case CallOrigin.streamChatResponse_withTools:
        return await this.doStreamWithTools(options)
      default:
        throw new NotImplementedException(
          `DEV - doStream is not implemented for callOrigin = ${callOrigin}}`,
        )
    }
  }
  private async formatMessages(prompt: LanguageModelV3Prompt[]) {
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
          .map((c) => `<tool_result name="${c.toolName}">${JSON.stringify(c.result)}</tool_result>`)
          .join("\n")
        messages.push({ role: "user", content: resultsText })
      } else {
        let content = ""
        if (Array.isArray(msg.content)) {
          content = msg.content.map((c) => c.text || "").join("")
        } else {
          content = msg.content || ""
        }
        messages.push({ role: msg.role, content })
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

    const responseJsonSchema = schema
    delete responseJsonSchema.$schema
    delete responseJsonSchema.additionalProperties

    const formattedMessages = await this.formatMessages(options.prompt)
    const jsonFormat = {
      type: "json_schema",
      json_schema: {
        name: "OutputFormat",
        schema: responseJsonSchema,
      },
    }

    const url = new URL("v1/chat/completions", this.baseUrl).toString()
    const body = {
      model: this.modelId,
      messages: formattedMessages,
      temperature: options.temperature,
      max_tokens: options.maxOutputTokens,
      stop: options.stopSequences,
      tools: undefined,
      ...(jsonFormat ? { response_format: jsonFormat } : undefined),
      stream: true,
      stream_options: { include_usage: true },
    }
    const stringifiedBody = JSON.stringify(body)

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        Connection: "close",
      },
      body: stringifiedBody,
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    let finishReason: LanguageModelV3FinishReason
    let usage: LanguageModelV3Usage

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      async start(controller) {
        let buffer = ""
        let responseBuffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer = decoder.decode(value)
          const lines = buffer.split("\n").filter((l) => l !== "")
          for (const line of lines) {
            const jsonStr = line.replace("data:", "").trim()
            if (jsonStr === "[DONE]") {
              const response = responseSchema.safeParse(JSON.parse(responseBuffer))
              if (!response.success) {
                throw new Error("Failed to parse response")
              }

              const metadata: SharedV3ProviderMetadata = {
                CustomMedgemma: providerOptionsToJson(options.providerOptions?.custom?.metadata),
              }
              const id = crypto.randomUUID()

              if (response.data.type === "answer") {
                controller.enqueue({
                  type: "text-start",
                  id,
                  providerMetadata: metadata,
                })
                controller.enqueue({
                  type: "text-delta",
                  delta: response.data.content,
                  id,
                  providerMetadata: metadata,
                })
                controller.enqueue({
                  type: "text-end",
                  id,
                  providerMetadata: metadata,
                })
              } else if (response.data.type === "tool") {
                const toolCallId = crypto.randomUUID()
                controller.enqueue({
                  type: "tool-call",
                  toolCallId,
                  toolName: response.data.name,
                  input: JSON.stringify(response.data.arguments),
                  providerMetadata: metadata,
                })
              }
              controller.enqueue({
                type: "finish",
                finishReason,
                providerMetadata: metadata,
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
              controller.close()
              return
            }

            // biome-ignore lint/suspicious/noExplicitAny: custom
            let data: any
            try {
              data = JSON.parse(jsonStr)
            } catch {
              continue
            }
            if (data.usage) {
              usage = data.usage
            }

            const choice = data.choices?.[0]
            if (!choice) continue
            if (choice.finish_reason) {
              finishReason = choice.finish_reason
            }

            const delta = choice.delta
            if (!delta) continue
            if (delta.content) {
              responseBuffer += delta.content
            }
          }
        }
        controller.close()
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

  headersToRecord(headers: Headers): Record<string, string> {
    const obj: Record<string, string> = {}
    headers.forEach((value, key) => {
      obj[key] = value
    })
    return obj
  }
}

// biome-ignore lint/suspicious/noExplicitAny: custom
function providerOptionsToJson(options: any | undefined): Record<string, any> {
  if (!options || typeof options !== "object") return {}

  // biome-ignore lint/suspicious/noExplicitAny: custom
  const json: Record<string, any> = {}

  for (const [key, value] of Object.entries(options)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      json[key] = value
    }
  }

  return json
}
