import { AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { NotImplementedException } from "@nestjs/common"
import { generateText, type JSONSchema7, jsonSchema, Output, ToolLoopAgent } from "ai"
import { type ZodObject, z } from "zod"
import type {
  LLMChatMessage,
  LLMConfig,
  LLMFile,
  LLMMetadata,
  LLMProvider,
} from "@/common/interfaces/llm-provider.interface"
import { removeNullish } from "@/common/utils/remove-nullish"

export abstract class AISDKLLMProviderBase implements LLMProvider {
  async *streamChatResponse({
    messages,
    config,
    metadata,
  }: {
    messages: LLMChatMessage[]
    config: LLMConfig
    metadata: LLMMetadata
  }): AsyncGenerator<string, void, unknown> {
    const callOrigin = config.tools
      ? CallOrigin.streamChatResponse_withTools
      : CallOrigin.streamChatResponse
    this.checkConfigProviderAndModel(config)
    const aiSDKMessages: LLMChatMessage[] = messages
      .map((message) => {
        if (message.role === "system") {
          return undefined
        }
        return {
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        }
      })
      .filter((msg) => msg !== undefined) as LLMChatMessage[]

    if (aiSDKMessages.length === 0) {
      throw new Error("Cannot stream response: no valid messages provided")
    }

    const systemMessage = messages.find((msg) => msg.role === "system")?.content

    const agent = new ToolLoopAgent({
      model: this.getLanguageModel({ config, callOrigin }),
      temperature: config.temperature,
      tools: config.tools,
      experimental_telemetry: {
        isEnabled: true,
        functionId: this.buildFunctionIdForStreamChatResponse(aiSDKMessages),
        metadata: this.buildMetadata({ config, metadata }),
      },
      providerOptions: {
        custom: { callOrigin, metadata: this.buildMetadata({ config, metadata }) },
      },
    })

    let systemPrompt = systemMessage || config.systemPrompt || ""
    systemPrompt = this.applySpecificToSystemPrompt({ systemPrompt, config, callOrigin })
    const systemMessagePart = systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }]
      : []

    const streamer = agent.stream({
      messages: [...systemMessagePart, ...aiSDKMessages],
    })

    for await (const chunk of (await streamer).textStream) {
      yield chunk
    }
  }
  async generateChatResponse({
    message,
    config,
    metadata,
  }: {
    message: LLMChatMessage
    config: LLMConfig
    metadata: LLMMetadata
  }): Promise<string> {
    const callOrigin = CallOrigin.generateChatResponse
    this.checkConfigProviderAndModel(config)
    const aiSDKMessages: LLMChatMessage[] = [message]
      .map((message) => {
        if (message.role === "system") {
          return undefined
        }
        return {
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        }
      })
      .filter((msg) => msg !== undefined) as LLMChatMessage[]

    if (aiSDKMessages.length === 0) {
      throw new Error("Cannot stream response: no valid messages provided")
    }

    const result = await generateText({
      model: this.getLanguageModel({ config, callOrigin }),
      messages: aiSDKMessages,
      system: config.systemPrompt,
      temperature: config.temperature,
      experimental_telemetry: {
        isEnabled: true,
        functionId: this.buildFunctionIdForStreamChatResponse(aiSDKMessages),
        metadata: this.buildMetadata({ config, metadata }),
      },
      providerOptions: {
        custom: { callOrigin, metadata: this.buildMetadata({ config, metadata }) },
      },
    })
    return result.text
  }
  async generateText({
    prompt,
    config,
    metadata,
  }: {
    prompt: string
    config: LLMConfig
    metadata: LLMMetadata
  }): Promise<string> {
    const callOrigin = CallOrigin.generateText
    const { text } = await generateText({
      model: this.getLanguageModel({ config, callOrigin }),
      system: config.systemPrompt,
      prompt,
      temperature: config.temperature,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "LLMProvider.generateText",
        metadata: this.buildMetadata({ config, metadata }),
      },
      providerOptions: {
        custom: { callOrigin, metadata: this.buildMetadata({ config, metadata }) },
      },
    })
    const { answer } = extractThoughtAndAnswer(text)
    return answer
  }

  // biome-ignore lint/suspicious/noExplicitAny: @did : une idée
  async generateObject<T extends ZodObject<any>>({
    schema,
    prompt,

    config,
    metadata,
  }: {
    schema: T
    prompt: string
    config: LLMConfig
    metadata: LLMMetadata
  }): Promise<z.infer<T>> {
    const callOrigin = CallOrigin.generateObject
    const res = await generateText({
      model: this.getLanguageModel({ config, callOrigin }),
      system: config.systemPrompt,
      prompt,
      temperature: config.temperature,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "LLMProvider.generateObject",
        metadata: this.buildMetadata({
          config,
          metadata,
          schema: schema.toJSONSchema() as JSONSchema7,
        }),
      },
      output: Output.object({
        schema: schema,
      }),
      providerOptions: {
        custom: {
          callOrigin,
          metadata: this.buildMetadata({
            config,
            metadata,
            schema: schema.toJSONSchema() as JSONSchema7,
          }),
        },
      },
    })
    return schema.parse(res.output)
  }

  async generateStructuredOutput({
    message,
    schema,
    config,
    metadata,
  }: {
    message: LLMChatMessage
    schema: Record<string, unknown>
    config: LLMConfig
    metadata: LLMMetadata
  }): Promise<Record<string, unknown>> {
    const callOrigin = CallOrigin.generateStructuredOutput
    if (AgentModelToAgentProvider[config.model] === AgentProvider._Mock) {
      const fakeFile: LLMFile = {
        type: "file",
        name: "file1.pdf",
        mediaType: "application/pdf",
        content: Buffer.from("%PDF-1.4\n%%EOF"),
      }
      message = {
        role: "user",
        content: [
          { type: "text", text: "prompt" },
          {
            type: fakeFile.type as "file",
            mediaType: fakeFile.mediaType,
            data: fakeFile.content,
            filename: fakeFile.name,
          },
        ],
      }
    }
    const aiSDKMessages: LLMChatMessage[] = [message]
      .map((currentMessage) => {
        if (currentMessage.role === "system") {
          return undefined
        }
        return {
          role: currentMessage.role === "assistant" ? "assistant" : "user",
          content: currentMessage.content,
        }
      })
      .filter((currentMessage) => currentMessage !== undefined) as LLMChatMessage[]

    if (aiSDKMessages.length === 0) {
      throw new Error("Cannot generate structured output: no valid messages provided")
    }

    const result = await generateText({
      model: this.getLanguageModel({ config, callOrigin }),
      messages: aiSDKMessages,
      system: config.systemPrompt,
      temperature: config.temperature,
      output: Output.object({
        schema: jsonSchema<Record<string, unknown>>(schema),
      }),
      experimental_telemetry: {
        isEnabled: true,
        functionId: "LLMProvider.generateStructuredOutput",
        metadata: this.buildMetadata({
          config,
          metadata,
          schema,
        }),
      },
      providerOptions: {
        custom: {
          callOrigin,
          metadata: this.buildMetadata({
            config,
            metadata,
            schema,
          }),
        },
      },
    })
    if (
      AgentModelToAgentProvider[config.model] === AgentProvider.MedGemma ||
      AgentModelToAgentProvider[config.model] === AgentProvider.Gemma
    ) {
      // @ts-expect-error
      return JSON.parse(result?.steps[0]?.content[0]?.text)
    }
    return result.output
  }
  // biome-ignore lint/suspicious/noExplicitAny: Zod def
  private recordToZodSchema(record: Record<string, unknown>): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {}

    for (const [key, value] of Object.entries(record)) {
      shape[key] = this.inferZodType(value)
    }

    return z.object(shape)
  }

  private inferZodType(value: unknown): z.ZodTypeAny {
    if (typeof value === "string") return z.string()
    if (typeof value === "number") return z.number()
    if (typeof value === "boolean") return z.boolean()
    if (value === null) return z.null()

    if (Array.isArray(value)) {
      if (value.length === 0) return z.array(z.any())
      return z.array(this.inferZodType(value[0]))
    }

    if (typeof value === "object") {
      return this.recordToZodSchema(value as Record<string, unknown>)
    }

    return z.any()
  }

  private checkConfigProviderAndModel(config: LLMConfig): void {
    const provider = AgentModelToAgentProvider[config.model]
    if (provider !== this.getAgentProvider())
      throw new NotImplementedException(
        `missing or invalid association between agent provider (${provider}) and agent model (${config.model})`,
      )
  }

  private buildFunctionIdForStreamChatResponse(aiSDKMessages: LLMChatMessage[]): string {
    return `LLMProvider.streamChatResponse [${aiSDKMessages.filter((m) => m.role === "assistant").length + 1} turn(s)]` //+1 => current turn
  }

  private buildMetadata({
    config,
    metadata,
    schema,
  }: {
    config: LLMConfig
    metadata: LLMMetadata
    schema?: JSONSchema7
  }): Record<string, string | number | string[]> {
    return removeNullish({
      langfuseTraceId: metadata.traceId,
      sessionId: `as:${metadata.agentSessionId}`,
      userId: `o:${metadata.organizationId} / p:${metadata.projectId}`,
      tags: [...this.getTags(config), ...(metadata?.tags || [])],
      currentTurn: metadata.currentTurn,
      outputSchema: JSON.stringify(schema),
      availableTools: JSON.stringify(config.tools),
    })
  }

  abstract getLanguageModel({ config, callOrigin }: { config: LLMConfig; callOrigin: CallOrigin })
  abstract getTags(config: LLMConfig): string[]
  abstract getAgentProvider(): AgentProvider

  applySpecificToSystemPrompt({
    // biome-ignore lint/correctness/noUnusedFunctionParameters: used in override
    config,
    systemPrompt,
    // biome-ignore lint/correctness/noUnusedFunctionParameters: used in override
    callOrigin,
  }: {
    config: LLMConfig
    systemPrompt: string
    callOrigin: CallOrigin
  }): string {
    return systemPrompt
  }
}

export enum CallOrigin {
  streamChatResponse = "streamChatResponse",
  streamChatResponse_withTools = "streamChatResponse_withTools",
  generateChatResponse = "generateChatResponse",
  generateText = "generateText",
  generateObject = "generateObject",
  generateStructuredOutput = "generateStructuredOutput",
}

export function extractThoughtAndAnswer(raw: string) {
  const thoughtMatch = raw.match(/<unused\d+>thought([\s\S]*?)(?=<unused\d+>)/i)
  if (!thoughtMatch) return { answer: raw }
  // @ts-expect-error
  const thought = thoughtMatch ? thoughtMatch[1].replace(/<unused\d+>/g, "").trim() : null
  let answer = raw.replace(/<unused\d+>thought[\s\S]*?(?=<unused\d+>)/gi, "")
  answer = answer.replace(/<unused\d+>/g, "").trim()
  return { thought, answer }
}
