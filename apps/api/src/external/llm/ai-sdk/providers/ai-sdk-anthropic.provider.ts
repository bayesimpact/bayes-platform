import { createVertexAnthropic } from "@ai-sdk/google-vertex/anthropic"
import { AgentModel, type AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import type { LanguageModel } from "ai"
import { z } from "zod"
import type {
  LLMConfig,
  ModelMetadata,
  ProviderMetadata,
} from "@/common/interfaces/llm-provider.interface"
import type { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import {
  defineModelOptions,
  type ModelInfos,
  type ModelOptions,
} from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"

type AnthropicAgentModel = AgentModelOf<AgentProvider.Anthropic>

/** The efforts Claude 5.x accepts: how much the model thinks. */
const effortSchema = z.enum(["low", "medium", "high"])
type ClaudeEffort = z.infer<typeof effortSchema>

/** "medium" keeps a chat turn short. */
const DEFAULT_EFFORT: ClaudeEffort = "medium"

/** An effort and no temperature: Claude 5.x models reject a temperature. */
const claudeModelOptions = () =>
  defineModelOptions(
    z.object({
      providerOptions: z.object({
        anthropic: z.object({ effort: effortSchema }),
      }),
    }),
    { providerOptions: { anthropic: { effort: DEFAULT_EFFORT } } },
  )

/**
 * Claude models, served by Vertex AI on the EU multi-region endpoint
 * (aiplatform.eu.rep.googleapis.com): the data stays in the EU, and the calls
 * use the same Google credentials and project as Gemini. The model must be
 * enabled in the Model Garden of the project, with a quota for the "eu" region.
 */
@Injectable()
export class AISDKAnthropicProvider extends AISDKLLMProviderBase<AgentProvider.Anthropic> {
  getAgentProvider(): AgentProvider.Anthropic {
    return AgentProvider.Anthropic
  }

  protected readonly modelOptions: Record<AnthropicAgentModel, ModelOptions> = {
    [AgentModel.ClaudeSonnet55]: claudeModelOptions(),
    [AgentModel.ClaudeHaiku55]: claudeModelOptions(),
    [AgentModel.ClaudeOpus5]: claudeModelOptions(),
  }
  /** All three are served on the "eu" multi-region. */
  protected readonly modelInfos: Record<AnthropicAgentModel, ModelInfos> = {
    [AgentModel.ClaudeSonnet55]: {},
    [AgentModel.ClaudeHaiku55]: {},
    [AgentModel.ClaudeOpus5]: {},
  }

  private readonly vertexProject: string
  private readonly vertexLocation = "eu"
  private readonly anthropicProvider: ReturnType<typeof createVertexAnthropic>
  private readonly anthropicProviderWithExtendedTimeouts: ReturnType<typeof createVertexAnthropic>

  constructor() {
    super()
    this.vertexProject = process.env.GOOGLE_VERTEX_PROJECT || "caseai-connect"

    // Default provider: relies on the AI SDK / undici default fetch timeouts.
    this.anthropicProvider = createVertexAnthropic({
      project: this.vertexProject,
      location: this.vertexLocation,
    })

    // Extended-timeout provider: opt-in via `config.useExtendedTimeouts` for
    // long-running calls (e.g. extraction agent runs). One client per mode, so
    // each keeps its access token cached.
    this.anthropicProviderWithExtendedTimeouts = createVertexAnthropic({
      project: this.vertexProject,
      location: this.vertexLocation,
      fetch: this.extendedTimeoutsFetch,
    })
  }

  getLanguageModel({ config }: { config: LLMConfig; callOrigin: CallOrigin }): LanguageModel {
    const provider = config.useExtendedTimeouts
      ? this.anthropicProviderWithExtendedTimeouts
      : this.anthropicProvider
    return provider(config.model)
  }

  override getProviderMetadata(): ProviderMetadata {
    return { ...super.getProviderMetadata(), project: this.vertexProject }
  }

  override getModelMetadata(config: LLMConfig): ModelMetadata {
    const stored = (
      config.modelOptions?.providerOptions as { anthropic?: { effort?: unknown } } | undefined
    )?.anthropic?.effort
    // An effort the model does not take is not sent: the call falls back to
    // the default, and the metadata reports the effort actually sent.
    const parsed = effortSchema.safeParse(stored)
    const effort = parsed.success ? parsed.data : DEFAULT_EFFORT
    // The effort is Claude's thinking level: one attribute for both.
    return {
      ...super.getModelMetadata(config),
      location: this.vertexLocation,
      thinkingLevel: effort.toUpperCase(),
    }
  }
}
