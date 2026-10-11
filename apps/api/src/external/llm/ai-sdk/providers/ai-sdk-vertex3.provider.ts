import { createVertex } from "@ai-sdk/google-vertex"
import {
  AgentModel,
  type AgentModelOf,
  AgentProvider,
  AgentThinkingLevel,
  isAgentModelServedOutsideEu,
} from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import type { LanguageModel } from "ai"
import { z } from "zod"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import type { SpecificProviderOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-builders"
import type { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import { defineModelOptions, type ModelOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"

type VertexLocation = "eu" | "global"

type Vertex3AgentModel = AgentModelOf<AgentProvider.Vertex3>

/** The thinking levels Gemini accepts: every level but auto, which picks the model's default. */
type VertexThinkingLevel = Exclude<AgentThinkingLevel, AgentThinkingLevel.Auto>

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
    AgentThinkingLevel.Minimal,
    AgentThinkingLevel.Low,
    AgentThinkingLevel.Medium,
    AgentThinkingLevel.High,
  ]

  private readonly vertex3Models: Record<Vertex3AgentModel, Vertex3Model> = {
    [AgentModel.Gemini31FlashLite]: {
      canSetTemperature: true,
      defaultLevel: AgentThinkingLevel.Minimal,
      levels: [...this.thinkingLevels],
    },
    [AgentModel.Gemini35FlashLite]: {
      canSetTemperature: false,
      defaultLevel: AgentThinkingLevel.Minimal,
      levels: [...this.thinkingLevels],
    },
    [AgentModel.Gemini35Flash]: {
      canSetTemperature: true,
      defaultLevel: AgentThinkingLevel.Medium,
      levels: [...this.thinkingLevels],
    },
    [AgentModel.Gemini36Flash]: {
      canSetTemperature: false,
      defaultLevel: AgentThinkingLevel.Medium,
      levels: [...this.thinkingLevels],
    },
    // Minimal was removed from 3.7 and up.
    [AgentModel.Gemini37Flash]: {
      canSetTemperature: false,
      defaultLevel: AgentThinkingLevel.Medium,
      levels: [AgentThinkingLevel.Low, AgentThinkingLevel.Medium, AgentThinkingLevel.High],
    },
    [AgentModel.Gemini38Flash]: {
      canSetTemperature: false,
      defaultLevel: AgentThinkingLevel.Medium,
      levels: [AgentThinkingLevel.Low, AgentThinkingLevel.Medium, AgentThinkingLevel.High],
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
            temperature: z.number(),
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
   * A model flagged `servedOutsideEu` in `AgentModelMetadataMap` is not served on the EU
   * regional endpoint (aiplatform.eu.rep.googleapis.com) and can only run through the "global"
   * endpoint, which does NOT guarantee EU data processing. Every other model stays on "eu"
   * (data residency).
   *
   * No model carries the flag since the 2026-09-04 probe: every Gemini 3.x flash and flash-lite
   * in the catalog answers on "eu" (3.6-flash was global-only at the 2026-07-30 probe). The same
   * catalog entry drives the "(non-EU)" label in the model pickers, so when a new model ships
   * global-only, set the flag there and routing and label follow together.
   */
  private locationForModel(model: string): VertexLocation {
    return isAgentModelServedOutsideEu(model) ? "global" : "eu"
  }

  getLanguageModel({ config }: { config: LLMConfig; callOrigin: CallOrigin }): LanguageModel {
    const location = this.locationForModel(config.model)
    const provider = config.useExtendedTimeouts
      ? this.vertexProvidersWithExtendedTimeouts[location]
      : this.vertexProviders[location]
    return provider(config.model)
  }

  /**
   * The model's options with the temperature (for a model whose agent can still set
   * one), the service tier and the thinking level the agent configured.
   */
  protected override applyConfigToModelOptions({
    config,
    values,
  }: {
    config: LLMConfig
    values: SpecificProviderOptions
  }): SpecificProviderOptions {
    const { vertex } = values.providerOptions as { vertex: VertexOptions }
    const thinkingLevel = this.thinkingLevelFor(config)
    return {
      ...super.applyConfigToModelOptions({ config, values }),
      providerOptions: {
        vertex: {
          ...vertex,
          ...(config.serviceTier ? { sharedRequestType: config.serviceTier } : {}),
          thinkingConfig: { ...vertex.thinkingConfig, ...(thinkingLevel ? { thinkingLevel } : {}) },
        },
      },
    }
  }

  /**
   * The configured thinking level, raised to the next one the model accepts
   * (minimal was removed from 3.7 and up). None for auto, or no level at all:
   * the model's default stays.
   */
  private thinkingLevelFor(config: LLMConfig): VertexThinkingLevel | undefined {
    const requestedRank = this.thinkingLevels.indexOf(config.thinkingLevel as VertexThinkingLevel)
    if (requestedRank === -1) return undefined
    const { levels } = this.vertex3Models[this.toProviderAgentModel(config.model)]
    return (
      levels.find((level) => this.thinkingLevels.indexOf(level) >= requestedRank) ?? levels.at(-1)
    )
  }

  getTags(config: LLMConfig): string[] {
    const tags = [this.vertexProject, this.locationForModel(config.model), config.model]
    if (config.serviceTier) tags.push(config.serviceTier.toUpperCase())
    tags.push(config.thinkingLevel.toUpperCase())
    return tags
  }
}
