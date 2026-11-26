import "../../open-telemetry-init" // !!!! first import !!!!
import { createOpenAI } from "@ai-sdk/openai"
import type { JSONSchema7, JSONSchema7Definition, LanguageModelV3 } from "@ai-sdk/provider"
import type { AgentProvider } from "@bayes-platform/api-contracts"
import { Inject, Injectable, NotImplementedException, Optional } from "@nestjs/common"
import { asSchema, type ToolSet } from "ai"
import type { LLMCallContext, LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { getAgentModelKey } from "@/external/llm/agent-provider"
import type { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"
import {
  MODEL_ENDPOINT_RESOLVER,
  type ModelEndpointResolver,
  type ModelEndpointSettings,
} from "@/external/llm/workspace-models/model-endpoint.types"

/**
 * A provider whose models we host on vLLM (Gemma, MedGemma, Mistral, Qwen).
 * Each model is reached through vLLM's OpenAI-compatible API, at the server a
 * workspace or the platform sets in the backoffice, or else at the URL and API
 * key of its `VLLM_<MODEL KEY>_URL` and `VLLM_<MODEL KEY>_APIKEY` environment
 * variables.
 */
@Injectable()
export abstract class AISDKVllmProviderBase<
  Provider extends AgentProvider,
> extends AISDKLLMProviderBase<Provider> {
  /** Name shown in the traces and tags, e.g. "Gemma Provider". */
  protected abstract readonly providerName: string

  /**
   * The resolver is optional: a provider built with `new`, or in a test module
   * without `ModelEndpointsModule`, always uses the environment variables.
   */
  constructor(
    @Optional()
    @Inject(MODEL_ENDPOINT_RESOLVER)
    private readonly modelEndpointResolver?: ModelEndpointResolver,
  ) {
    super()
  }

  protected override async resolveEndpoint({
    config,
    callContext,
  }: {
    config: LLMConfig
    callContext: LLMCallContext
  }): Promise<ModelEndpointSettings | undefined> {
    if (!this.modelEndpointResolver) return undefined
    const endpoint = await this.modelEndpointResolver.resolveEndpoint({
      callContext,
      model: config.model,
    })
    return endpoint ?? undefined
  }

  /** By default every call goes through the OpenAI-compatible chat API. */
  getLanguageModel({
    config,
    endpoint,
  }: {
    config: LLMConfig
    callOrigin: CallOrigin
    endpoint?: ModelEndpointSettings
  }): LanguageModelV3 {
    return this.createOpenAiCompatibleChatModel(config, endpoint)
  }

  /**
   * The OpenAI-compatible chat model. The API key of the model goes in the
   * `Authorization: Bearer` header, which is what vLLM checks when it runs
   * with `--api-key`.
   */
  protected createOpenAiCompatibleChatModel(
    config: LLMConfig,
    endpoint?: ModelEndpointSettings,
  ): LanguageModelV3 {
    const { url, apiKey, modelName } = this.getModelSettings(config.model, endpoint)
    return createOpenAI({
      name: this.providerName,
      baseURL: url,
      apiKey,
      fetch: this.fetchFor(config),
    }).chat(modelName)
  }

  /**
   * The URL, API key and model name of a call. On a server the workspace
   * added: its URL, its key (else the environment's, else none, as a vLLM
   * without `--api-key` takes any) and its served name (else the model id).
   * Otherwise the environment variables of the model.
   */
  protected getModelSettings(
    model: string,
    endpoint?: ModelEndpointSettings,
  ): { url: string; apiKey: string; modelName: string } {
    if (!endpoint) return { ...this.getModelEnvSettings(model), modelName: model }
    const agentModelKey = getAgentModelKey(model)
    const envApiKey = agentModelKey
      ? process.env[`VLLM_${agentModelKey.toUpperCase()}_APIKEY`]
      : undefined
    return {
      url: endpoint.url,
      apiKey: endpoint.apiKey ?? envApiKey ?? "<not used>",
      modelName: endpoint.servedModelName ?? model,
    }
  }

  protected getModelEnvSettings(model: string): { url: string; apiKey: string } {
    const agentModelKey = getAgentModelKey(model)
    if (!agentModelKey) throw new NotImplementedException(`DEV - Unknown model: ${model}`)
    const envKeyUrl = `VLLM_${agentModelKey.toUpperCase()}_URL`
    const url = process.env[envKeyUrl]
    if (!url) throw new NotImplementedException(`DEV - Missing environment variable: ${envKeyUrl}`)
    const envKeyApiKey = `VLLM_${agentModelKey.toUpperCase()}_APIKEY`
    const apiKey = process.env[envKeyApiKey]
    if (!apiKey)
      throw new NotImplementedException(`DEV - Missing environment variable: ${envKeyApiKey}`)
    return { url, apiKey }
  }

  /**
   * One line per tool, `- name: description` then its parameters, for the
   * models that read their tools in the system prompt (MedGemma).
   * Undefined when there is no tool.
   */
  protected describeToolsForPrompt(tools: ToolSet): string[] | undefined {
    const namedTools = Object.entries(tools)
    if (namedTools.length === 0) return undefined
    return namedTools.map(
      ([name, tool]) =>
        `- ${name}: ${tool.description ?? ""}\n  Parameters: ${this.inputSchemaToArgumentString(tool.inputSchema)}`,
    )
  }

  /**
   * Renders the JSON Schema of a tool input, whether the tool declares it
   * with zod or as a JSON Schema (MCP tools): the AI SDK converts both.
   */
  private inputSchemaToArgumentString(inputSchema: Parameters<typeof asSchema>[0]): string {
    const jsonSchema = asSchema(inputSchema).jsonSchema
    // A schema only available asynchronously cannot go into a synchronous prompt.
    if (typeof (jsonSchema as PromiseLike<JSONSchema7>).then === "function") return "unknown"
    return this.jsonSchemaToArgumentString(jsonSchema as JSONSchema7)
  }

  /**
   * A compact, TypeScript-like rendering of a JSON Schema, e.g.
   * `{ query: string; limit: number | null }`. In a union, the first member
   * is the intended type: the others (`null`, the lenient `string` of
   * `zNullableType`) only widen what is accepted, so only `| null` is kept.
   * A field that is not required reads `| null` too, unless it has a default.
   */
  protected jsonSchemaToArgumentString(schema: JSONSchema7Definition | undefined): string {
    if (schema === undefined || typeof schema === "boolean") return "unknown"

    if (schema.default !== undefined) {
      const { default: defaultValue, ...withoutDefault } = schema
      return `${this.jsonSchemaToArgumentString(withoutDefault)} (default: ${this.formatDefault(defaultValue)})`
    }

    const members = schema.anyOf ?? schema.oneOf
    if (members) {
      const isNull = (member: JSONSchema7Definition) =>
        typeof member === "object" && member.type === "null"
      const intended = this.jsonSchemaToArgumentString(members.find((member) => !isNull(member)))
      return members.some(isNull) ? `${intended} | null` : intended
    }

    if (Array.isArray(schema.type)) {
      const intended = this.jsonSchemaToArgumentString({
        ...schema,
        type: schema.type.find((type) => type !== "null"),
      })
      return schema.type.includes("null") ? `${intended} | null` : intended
    }

    if (schema.enum) return schema.enum.map((value) => this.formatValue(value)).join(" | ")
    if (schema.const !== undefined) return this.formatValue(schema.const)

    switch (schema.type) {
      case "string":
        return "string"
      case "number":
      case "integer":
        return "number"
      case "boolean":
        return "boolean"
      case "array": {
        const items = Array.isArray(schema.items) ? schema.items[0] : schema.items
        const inner = this.jsonSchemaToArgumentString(items)
        return /\s/.test(inner) ? `Array<${inner}>` : `${inner}[]`
      }
      case "object": {
        if (!schema.properties) return "object"
        const required = new Set(schema.required ?? [])
        const fields = Object.entries(schema.properties).map(([key, value]) => {
          const rendered = this.jsonSchemaToArgumentString(value)
          const hasDefault = typeof value === "object" && value.default !== undefined
          const nullable =
            !required.has(key) && !hasDefault && !rendered.endsWith("| null") ? " | null" : ""
          return `${key}: ${rendered}${nullable}`
        })
        return `{ ${fields.join("; ")} }`
      }
      default:
        return "unknown"
    }
  }

  private formatValue(value: unknown): string {
    return typeof value === "string" ? `'${value}'` : String(value)
  }

  private formatDefault(value: unknown): string {
    if (typeof value === "string") return `'${value.replace(/'/g, "\\'")}'`
    if (typeof value === "object" && value !== null) return JSON.stringify(value)
    return String(value)
  }
}
