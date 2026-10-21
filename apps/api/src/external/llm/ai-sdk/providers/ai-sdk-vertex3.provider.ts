import { createVertex } from "@ai-sdk/google-vertex"
import { AgentModel, type AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import type { LanguageModel } from "ai"
import { z } from "zod"
import type { LLMConfig, LLMModelOptions } from "@/common/interfaces/llm-provider.interface"
import type { SpecificProviderOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-builders"
import type { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import {
  defineModelOptions,
  type ModelInfos,
  type ModelOptions,
} from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"

type VertexLocation = "eu" | "global"

type Vertex3AgentModel = AgentModelOf<AgentProvider.Vertex3>

/** The thinking levels Gemini accepts. */
type VertexThinkingLevel = "minimal" | "low" | "medium" | "high"

type Vertex3Model = {
  /**
   * Whether the agent can still set the model's temperature, which defaults
   * to Google's 1. Google deprecated it (with top_p and top_k) from Gemini 3.6
   * Flash and 3.5 Flash-Lite on, for all later models: ignored for now,
   * rejected with a 400 by future ones.
   */
  canSetTemperature: boolean
  /** The official default thinking level. */
  defaultLevel: VertexThinkingLevel
  /** The thinking levels the model accepts. */
  levels: [VertexThinkingLevel, ...VertexThinkingLevel[]]
}

type VertexOptions = {
  sharedRequestType?: "priority" | "flex"
  thinkingConfig: { thinkingLevel: VertexThinkingLevel; includeThoughts: boolean }
}

@Injectable()
export class AISDKVertex3Provider extends AISDKLLMProviderBase<AgentProvider.Vertex3> {
  getAgentProvider(): AgentProvider.Vertex3 {
    return AgentProvider.Vertex3
  }

  /** The thinking levels Gemini accepts, from the lowest to the highest. */
  private readonly thinkingLevels: [VertexThinkingLevel, ...VertexThinkingLevel[]] = [
    "minimal",
    "low",
    "medium",
    "high",
  ]

  private readonly vertex3Models: Record<Vertex3AgentModel, Vertex3Model> = {
    [AgentModel.Gemini31FlashLite]: {
      canSetTemperature: true,
      defaultLevel: "minimal",
      levels: [...this.thinkingLevels],
    },
    [AgentModel.Gemini35FlashLite]: {
      canSetTemperature: false,
      defaultLevel: "minimal",
      levels: [...this.thinkingLevels],
    },
    [AgentModel.Gemini35Flash]: {
      canSetTemperature: true,
      defaultLevel: "medium",
      levels: [...this.thinkingLevels],
    },
    [AgentModel.Gemini36Flash]: {
      canSetTemperature: false,
      defaultLevel: "medium",
      levels: [...this.thinkingLevels],
    },
    // Minimal was removed from 3.7 and up.
    [AgentModel.Gemini37Flash]: {
      canSetTemperature: false,
      defaultLevel: "medium",
      levels: ["low", "medium", "high"],
    },
    [AgentModel.Gemini38Flash]: {
      canSetTemperature: false,
      defaultLevel: "medium",
      levels: ["low", "medium", "high"],
    },
  }

  protected readonly modelOptions = Object.fromEntries(
    Object.entries(this.vertex3Models).map(([agentModel, vertex3Model]) => [
      agentModel,
      this.vertex3ModelOptions(vertex3Model),
    ]),
  ) as Record<Vertex3AgentModel, ModelOptions>

  /**
   * A temperature when the agent can still set one, a service tier and a
   * thinking level among those the model accepts.
   */
  private vertex3ModelOptions({
    canSetTemperature,
    defaultLevel,
    levels,
  }: Vertex3Model): ModelOptions {
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

  /**
   * Gemini enforces tool argument schemas for strict tools (mode VALIDATED):
   * enums hold even under adversarial user injections, while the model still
   * answers with text in the same generation — measured on 3.6-flash and
   * 3.5-flash-lite (probe 2026-07-30). Length constraints are NOT enforced;
   * Zod remains the application-side barrier.
   */
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
    // unless they are only served globally — see GLOBAL_ONLY_MODELS.
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

  /**
   * No model is served outside the EU since the 2026-09-04 probe: every Gemini 3.x flash and
   * flash-lite answers on "eu" (3.6-flash was global-only at the 2026-07-30 probe). When a new
   * model ships global-only, set `servedOutsideEu` here: the routing and the "(non-EU)" label of
   * the model pickers follow together.
   */
  protected readonly modelInfos: Record<Vertex3AgentModel, ModelInfos> = {
    [AgentModel.Gemini31FlashLite]: {},
    [AgentModel.Gemini35FlashLite]: {},
    [AgentModel.Gemini35Flash]: {},
    [AgentModel.Gemini36Flash]: {},
    [AgentModel.Gemini37Flash]: {},
    [AgentModel.Gemini38Flash]: {},
  }

  /**
   * A model flagged `servedOutsideEu` is not served on the EU regional endpoint
   * (aiplatform.eu.rep.googleapis.com) and can only run through the "global" endpoint, which does
   * NOT guarantee EU data processing. Every other model stays on "eu" (data residency).
   */
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

  /**
   * The model's options with the service tier of the call, and only that one: the tier
   * follows the project flags and the agent's toggle, never a tier left in stored options.
   */
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

  /** The thinking level the call asks for: the agent's stored one, or the model's default. */
  private thinkingLevelTag(config: LLMConfig): string {
    const stored = (
      config.modelOptions?.providerOptions as { vertex?: Partial<VertexOptions> } | undefined
    )?.vertex?.thinkingConfig?.thinkingLevel
    return stored ?? this.vertex3Models[this.toProviderAgentModel(config.model)].defaultLevel
  }

  /**
   * Nothing: an internal call runs on the model's defaults. Google advises keeping Gemini 3 at
   * its default temperature of 1 with thinking on, and these calls ran at 1 when no Gemini 3
   * call carried a temperature.
   */
  override getInternalCallModelOptions(_agentModel: AgentModel): LLMModelOptions {
    return {}
  }

  getTelemetryMetadata(config: LLMConfig): Record<string, string | number | string[]> {
    return {
      project: this.vertexProject,
      location: this.locationForModel(config.model),
      thinkingLevel: this.thinkingLevelTag(config).toUpperCase(),
      ...(config.serviceTier ? { serviceTier: config.serviceTier.toUpperCase() } : {}),
    }
  }
}
