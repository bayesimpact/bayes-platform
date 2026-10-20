import "../../open-telemetry-init" // !!!! first import !!!!
import { createOpenAI } from "@ai-sdk/openai"
import type { JSONSchema7, JSONSchema7Definition, LanguageModelV3 } from "@ai-sdk/provider"
import type { AgentProvider } from "@caseai-connect/api-contracts"
import { NotImplementedException } from "@nestjs/common"
import { asSchema, type ToolSet } from "ai"
import { GoogleAuth } from "google-auth-library"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { getAgentModelKey } from "@/external/llm/agent-provider"
import type { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"

/**
 * A provider whose models we host on vLLM (Gemma, MedGemma, Mistral). Each
 * model is reached at the URL and API key of its `VLLM_<MODEL KEY>_URL` and
 * `VLLM_<MODEL KEY>_APIKEY` environment variables, through vLLM's
 * OpenAI-compatible API.
 */
export abstract class AISDKVllmProviderBase<
  Provider extends AgentProvider,
> extends AISDKLLMProviderBase<Provider> {
  /** Name shown in the traces and tags, e.g. "Gemma Provider". */
  protected abstract readonly providerName: string

  private googleAuth?: Pick<GoogleAuth, "getClient">

  /**
   * One client for the provider's lifetime, so the access token is cached
   * instead of fetched again for every model built. Created on first use:
   * a provider that never calls the OpenAI-compatible chat API (MedGemma)
   * does not need one.
   */
  protected get auth(): Pick<GoogleAuth, "getClient"> {
    this.googleAuth ??= new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    })
    return this.googleAuth
  }

  /** By default every call goes through the OpenAI-compatible chat API. */
  getLanguageModel({ config }: { config: LLMConfig; callOrigin: CallOrigin }): LanguageModelV3 {
    return this.createOpenAiCompatibleChatModel(config)
  }

  // protected abstract getModelMetadata(config: LLMConfig): Record<string, string | number | string[]>

  /**
   * The OpenAI-compatible chat model, authenticated with a Google access token
   * (the vLLM endpoints sit behind Google Cloud authentication).
   */
  protected createOpenAiCompatibleChatModel(config: LLMConfig): LanguageModelV3 {
    const auth = this.auth
    const fetchForCall = this.fetchFor(config)
    const { url, apiKey } = this.getModelEnvSettings(config.model)
    return createOpenAI({
      name: this.providerName,
      baseURL: url,
      apiKey,
      fetch: async (requestUrl, init) => {
        const client = await auth.getClient()
        const { token } = await client.getAccessToken()
        const headers = new Headers(init?.headers)
        headers.set("Authorization", `Bearer ${token}`)
        return fetchForCall(requestUrl, { ...init, headers })
      },
    }).chat(config.model)
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
   * models that read their tools in the system prompt (Mistral, MedGemma).
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
