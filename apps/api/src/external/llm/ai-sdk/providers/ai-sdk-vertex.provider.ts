import { createVertex } from "@ai-sdk/google-vertex"
import { AgentModel, type AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import type { LanguageModel } from "ai"
import { z } from "zod"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import type { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import { defineModelOptions, type ModelOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"

type VertexAgentModel = AgentModelOf<AgentProvider.Vertex>

@Injectable()
export class AISDKVertexProvider extends AISDKLLMProviderBase<AgentProvider.Vertex> {
  getAgentProvider(): AgentProvider.Vertex {
    return AgentProvider.Vertex
  }

  protected readonly modelOptions: Record<VertexAgentModel, ModelOptions> = {
    [AgentModel.Gemini25Flash]: defineModelOptions(z.object({ temperature: z.number() }), {
      temperature: 0,
    }),
    [AgentModel.Gemini25Pro]: defineModelOptions(z.object({ temperature: z.number() }), {
      temperature: 0,
    }),
  }
  private readonly vertexProvider: ReturnType<typeof createVertex>
  private readonly vertexProviderWithExtendedTimeouts: ReturnType<typeof createVertex>
  private readonly vertexProject: string
  private readonly vertexLocation: string

  constructor() {
    super()
    this.vertexProject = process.env.GOOGLE_VERTEX_PROJECT || "caseai-connect"
    this.vertexLocation = process.env.GOOGLE_VERTEX_LOCATION || "europe-west1"

    // Default provider: relies on the AI SDK / undici default fetch timeouts.
    this.vertexProvider = createVertex({
      project: this.vertexProject,
      location: this.vertexLocation,
    })

    // Extended-timeout provider: opt-in via `config.useExtendedTimeouts` for
    // long-running calls (e.g. extraction agent runs). One client per mode, so
    // each keeps its access token cached.
    this.vertexProviderWithExtendedTimeouts = createVertex({
      project: this.vertexProject,
      location: this.vertexLocation,
      fetch: this.extendedTimeoutsFetch,
    })
  }

  getLanguageModel({ config }: { config: LLMConfig; callOrigin: CallOrigin }): LanguageModel {
    const provider = config.useExtendedTimeouts
      ? this.vertexProviderWithExtendedTimeouts
      : this.vertexProvider
    return provider(config.model)
  }
  getTags(config: LLMConfig): string[] {
    return [this.vertexProject, this.vertexLocation, config.model]
  }
}
