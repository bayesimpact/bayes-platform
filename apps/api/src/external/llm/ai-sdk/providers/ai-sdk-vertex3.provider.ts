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
import { Agent, fetch as undiciFetch } from "undici"
import { z } from "zod"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import type { SpecificProviderOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-builders"
import type { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import { defineModelOptions, type ModelOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"

// Default network timeouts (ms) applied to the extended-timeout fetch when the
// corresponding env vars are unset. Sized for long-running calls such as
// extraction agent runs.
const DEFAULT_HEADERS_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const DEFAULT_BODY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const DEFAULT_CONNECT_TIMEOUT_MS = 30 * 1000 // 30 seconds

function readTimeoutMs(value: string | undefined, defaultMs: number): number {
  if (!value) return defaultMs
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? defaultMs : parsed
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
type VertexLocation = "eu" | "global"

function locationForModel(model: string): VertexLocation {
  return isAgentModelServedOutsideEu(model) ? "global" : "eu"
}

type Vertex3AgentModel = AgentModelOf<AgentProvider.Vertex3>

/** The thinking levels Gemini accepts, from the lowest to the highest. */
const VERTEX_THINKING_LEVELS = [
  AgentThinkingLevel.Minimal,
  AgentThinkingLevel.Low,
  AgentThinkingLevel.Medium,
  AgentThinkingLevel.High,
] as const
type VertexThinkingLevel = (typeof VERTEX_THINKING_LEVELS)[number]

type Vertex3Model = {
  /**
   * Whether the model still takes a temperature. Google deprecated it (with
   * top_p and top_k) from Gemini 3.6 Flash and 3.5 Flash-Lite on, for all
   * later models: ignored for now, rejected with a 400 by future ones.
   */
  takesTemperature: boolean
  /** The official default thinking level. */
  defaultLevel: VertexThinkingLevel
  /** The thinking levels the model accepts. */
  levels: [VertexThinkingLevel, ...VertexThinkingLevel[]]
}

const VERTEX3_MODELS: Record<Vertex3AgentModel, Vertex3Model> = {
  [AgentModel.Gemini31FlashLite]: {
    takesTemperature: true,
    defaultLevel: AgentThinkingLevel.Minimal,
    levels: [...VERTEX_THINKING_LEVELS],
  },
  [AgentModel.Gemini35FlashLite]: {
    takesTemperature: false,
    defaultLevel: AgentThinkingLevel.Minimal,
    levels: [...VERTEX_THINKING_LEVELS],
  },
  [AgentModel.Gemini35Flash]: {
    takesTemperature: true,
    defaultLevel: AgentThinkingLevel.Medium,
    levels: [...VERTEX_THINKING_LEVELS],
  },
  [AgentModel.Gemini36Flash]: {
    takesTemperature: false,
    defaultLevel: AgentThinkingLevel.Medium,
    levels: [...VERTEX_THINKING_LEVELS],
  },
  // Minimal was removed from 3.7 and up.
  [AgentModel.Gemini37Flash]: {
    takesTemperature: false,
    defaultLevel: AgentThinkingLevel.Medium,
    levels: [AgentThinkingLevel.Low, AgentThinkingLevel.Medium, AgentThinkingLevel.High],
  },
  [AgentModel.Gemini38Flash]: {
    takesTemperature: false,
    defaultLevel: AgentThinkingLevel.Medium,
    levels: [AgentThinkingLevel.Low, AgentThinkingLevel.Medium, AgentThinkingLevel.High],
  },
}

type VertexOptions = {
  sharedRequestType?: "priority" | "flex"
  thinkingConfig: { thinkingLevel: VertexThinkingLevel; includeThoughts: boolean }
}

/**
 * A temperature when the model still takes one, a service tier and a
 * thinking level among those the model accepts.
 */
function vertex3ModelOptions({
  takesTemperature,
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
  return takesTemperature
    ? defineModelOptions(
        z.object({ temperature: z.number(), providerOptions: z.object({ vertex: vertexSchema }) }),
        { temperature: 0, providerOptions: { vertex } },
      )
    : defineModelOptions(z.object({ providerOptions: z.object({ vertex: vertexSchema }) }), {
        providerOptions: { vertex },
      })
}

@Injectable()
export class AISDKVertex3Provider extends AISDKLLMProviderBase<AgentProvider.Vertex3> {
  getAgentProvider(): AgentProvider.Vertex3 {
    return AgentProvider.Vertex3
  }

  protected readonly modelOptions = Object.fromEntries(
    Object.entries(VERTEX3_MODELS).map(([agentModel, vertex3Model]) => [
      agentModel,
      vertex3ModelOptions(vertex3Model),
    ]),
  ) as Record<Vertex3AgentModel, ModelOptions>

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
    const buildProvider = (location: VertexLocation, fetch?: typeof undiciFetch) =>
      createVertex({
        project: this.vertexProject,
        location,
        ...(fetch ? { fetch: fetch as unknown as typeof globalThis.fetch } : {}),
      })

    // Default providers: rely on the AI SDK / undici default fetch timeouts.
    this.vertexProviders = {
      eu: buildProvider("eu"),
      global: buildProvider("global"),
    }

    // Extended-timeout providers: opt-in via `config.useExtendedTimeouts` for
    // long-running calls (e.g. extraction agent runs). The three timeouts are
    // configurable through env vars; a single dispatcher is reused across calls.
    const extendedTimeoutDispatcher = new Agent({
      headersTimeout: readTimeoutMs(
        process.env.VERTEX_FETCH_HEADERS_TIMEOUT_MS,
        DEFAULT_HEADERS_TIMEOUT_MS,
      ),
      bodyTimeout: readTimeoutMs(process.env.VERTEX_FETCH_BODY_TIMEOUT_MS, DEFAULT_BODY_TIMEOUT_MS),
      connectTimeout: readTimeoutMs(
        process.env.VERTEX_FETCH_CONNECT_TIMEOUT_MS,
        DEFAULT_CONNECT_TIMEOUT_MS,
      ),
    })
    const extendedTimeoutFetch: typeof undiciFetch = (url, options) =>
      undiciFetch(url, { ...options, dispatcher: extendedTimeoutDispatcher })
    this.vertexProvidersWithExtendedTimeouts = {
      eu: buildProvider("eu", extendedTimeoutFetch),
      global: buildProvider("global", extendedTimeoutFetch),
    }
  }

  getLanguageModel({ config }: { config: LLMConfig; callOrigin: CallOrigin }): LanguageModel {
    const location = locationForModel(config.model)
    const provider = config.useExtendedTimeouts
      ? this.vertexProvidersWithExtendedTimeouts[location]
      : this.vertexProviders[location]
    return provider(config.model)
  }

  /**
   * The model's options with the temperature (for a model that still takes
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
    const requestedRank = VERTEX_THINKING_LEVELS.indexOf(
      config.thinkingLevel as VertexThinkingLevel,
    )
    if (requestedRank === -1) return undefined
    const { levels } = VERTEX3_MODELS[this.toProviderAgentModel(config.model)]
    return (
      levels.find((level) => VERTEX_THINKING_LEVELS.indexOf(level) >= requestedRank) ??
      levels.at(-1)
    )
  }

  getTags(config: LLMConfig): string[] {
    const tags = [this.vertexProject, locationForModel(config.model), config.model]
    if (config.serviceTier) tags.push(config.serviceTier.toUpperCase())
    tags.push(config.thinkingLevel.toUpperCase())
    return tags
  }
}
