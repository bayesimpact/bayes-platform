import { createVertex } from "@ai-sdk/google-vertex"
import type { AgentModel, AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import type { LanguageModel } from "ai"
import { z } from "zod"
import type {
  LLMConfig,
  LLMModelOptions,
  ModelMetadata,
  ProviderMetadata,
} from "@/common/interfaces/llm-provider.interface"
import type { SpecificProviderOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-builders"
import type { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import { defineModelOptions, type ModelOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"

type VertexLocation = "eu" | "global"

export type GeminiAgentProvider = AgentProvider.Vertex3 | AgentProvider.Vertex4
type VertexThinkingLevel = "minimal" | "low" | "medium" | "high"

export type GeminiModel = {
  canSetTemperature: boolean
  defaultLevel: VertexThinkingLevel
  levels: [VertexThinkingLevel, ...VertexThinkingLevel[]]
}

type VertexOptions = {
  sharedRequestType?: "priority" | "flex"
  thinkingConfig: { thinkingLevel: VertexThinkingLevel; includeThoughts: boolean }
}
export abstract class AISDKGeminiProviderBase<
  Provider extends GeminiAgentProvider,
> extends AISDKLLMProviderBase<Provider> {
  protected readonly thinkingLevels: [VertexThinkingLevel, ...VertexThinkingLevel[]] = [
    "minimal",
    "low",
    "medium",
    "high",
  ]

  protected abstract readonly geminiModels: Record<AgentModelOf<Provider>, GeminiModel>

  protected buildModelOptions(
    geminiModels: Record<AgentModelOf<Provider>, GeminiModel>,
  ): Record<AgentModelOf<Provider>, ModelOptions> {
    return Object.fromEntries(
      Object.entries<GeminiModel>(geminiModels).map(([agentModel, geminiModel]) => [
        agentModel,
        this.geminiModelOptions(geminiModel),
      ]),
    ) as Record<AgentModelOf<Provider>, ModelOptions>
  }

  private geminiModelOptions({
    canSetTemperature,
    defaultLevel,
    levels,
  }: GeminiModel): ModelOptions {
    const vertexSchema = z.object({
      sharedRequestType: z.enum(["priority", "flex"]).optional(),
      thinkingConfig: z.object({ thinkingLevel: z.enum(levels), includeThoughts: z.boolean() }),
    })
    const vertex: VertexOptions = {
      thinkingConfig: { thinkingLevel: defaultLevel, includeThoughts: true },
    }
    return canSetTemperature
      ? defineModelOptions(
          z.object({
            temperature: z.number().min(0).max(2),
            providerOptions: z.object({ vertex: vertexSchema }),
          }),
          { temperature: 1, providerOptions: { vertex } },
        )
      : defineModelOptions(z.object({ providerOptions: z.object({ vertex: vertexSchema }) }), {
          providerOptions: { vertex },
        })
  }
  protected override supportsStrictTools(): boolean {
    return true
  }
  private readonly vertexProviders: Record<VertexLocation, ReturnType<typeof createVertex>>
  private readonly vertexProvidersWithExtendedTimeouts: Record<
    VertexLocation,
    ReturnType<typeof createVertex>
  >
  private readonly vertexProject: string

  constructor() {
    super()
    this.vertexProject = process.env.GOOGLE_VERTEX_PROJECT || "caseai-connect"

    // One provider per location: models run on "eu" (EU data residency)
    // unless they are only served globally (`servedOutsideEu`).
    const buildProvider = (location: VertexLocation, fetch?: typeof globalThis.fetch) =>
      createVertex({ project: this.vertexProject, location, ...(fetch ? { fetch } : {}) })

    // Default providers: rely on the AI SDK / undici default fetch timeouts.
    this.vertexProviders = {
      eu: buildProvider("eu"),
      global: buildProvider("global"),
    }

    // Extended-timeout providers: opt-in via `config.useExtendedTimeouts` for
    // long-running calls (e.g. extraction agent runs). One client per location
    // and mode, so each keeps its access token cached.
    this.vertexProvidersWithExtendedTimeouts = {
      eu: buildProvider("eu", this.extendedTimeoutsFetch),
      global: buildProvider("global", this.extendedTimeoutsFetch),
    }
  }

  private locationForModel(model: string): VertexLocation {
    return this.modelInfos[this.toProviderAgentModel(model)].servedOutsideEu ? "global" : "eu"
  }

  getLanguageModel({ config }: { config: LLMConfig; callOrigin: CallOrigin }): LanguageModel {
    const location = this.locationForModel(config.model)
    const provider = config.useExtendedTimeouts
      ? this.vertexProvidersWithExtendedTimeouts[location]
      : this.vertexProviders[location]
    return provider(config.model)
  }

  protected override applyConfigToModelOptions({
    config,
    values,
  }: {
    config: LLMConfig
    values: SpecificProviderOptions
  }): SpecificProviderOptions {
    const { vertex } = values.providerOptions as { vertex: VertexOptions }
    const { sharedRequestType: _storedTier, ...vertexWithoutTier } = vertex
    return {
      ...values,
      providerOptions: {
        vertex: config.serviceTier
          ? { ...vertexWithoutTier, sharedRequestType: config.serviceTier }
          : vertexWithoutTier,
      },
    }
  }

  private thinkingLevelTag(config: LLMConfig): string {
    const stored = (
      config.modelOptions?.providerOptions as { vertex?: Partial<VertexOptions> } | undefined
    )?.vertex?.thinkingConfig?.thinkingLevel
    return stored ?? this.geminiModels[this.toProviderAgentModel(config.model)].defaultLevel
  }

  override getInternalCallModelOptions(_agentModel: AgentModel): LLMModelOptions {
    return {}
  }

  override getProviderMetadata(): ProviderMetadata {
    return { ...super.getProviderMetadata(), project: this.vertexProject }
  }

  override getModelMetadata(config: LLMConfig): ModelMetadata {
    return {
      ...super.getModelMetadata(config),
      location: this.locationForModel(config.model),
      thinkingLevel: this.thinkingLevelTag(config).toUpperCase(),
      serviceTier: config.serviceTier?.toUpperCase(),
    }
  }
}
