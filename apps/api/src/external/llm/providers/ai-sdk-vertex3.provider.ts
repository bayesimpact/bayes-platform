import { createVertex } from "@ai-sdk/google-vertex"
import type { JSONValue } from "@ai-sdk/provider"
import { AgentProvider, isAgentModelServedOutsideEu } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import type { LanguageModel } from "ai"
import { Agent, fetch as undiciFetch } from "undici"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import type { CallOrigin } from "@/external/llm/ai-sdk-llm-common"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk-llm-provider-base"

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

@Injectable()
export class AISDKVertex3Provider extends AISDKLLMProviderBase {
  getAgentProvider(): AgentProvider {
    return AgentProvider.Vertex3
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

  protected override buildNativeProviderOptions({
    config,
  }: {
    config: LLMConfig
  }): Record<string, Record<string, JSONValue>> {
    if (!config.serviceTier) return {}
    return { vertex: { sharedRequestType: config.serviceTier } }
  }

  getTags(config: LLMConfig): string[] {
    const tags = [this.vertexProject, locationForModel(config.model), config.model]
    if (config.serviceTier) tags.push(config.serviceTier.toUpperCase())
    return tags
  }
}
