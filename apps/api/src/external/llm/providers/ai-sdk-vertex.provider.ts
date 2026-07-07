import { createVertex } from "@ai-sdk/google-vertex"
import { AgentProvider } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import type { LanguageModel } from "ai"
import { Agent, fetch as undiciFetch } from "undici"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { AISDKLLMProviderBase, type CallOrigin } from "@/external/llm/ai-sdk-llm-provider-base"

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

@Injectable()
export class AISDKVertexProvider extends AISDKLLMProviderBase {
  getAgentProvider(): AgentProvider {
    return AgentProvider.Vertex
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
    this.vertexProviderWithExtendedTimeouts = createVertex({
      project: this.vertexProject,
      location: this.vertexLocation,
      fetch: (...args) => {
        const [url, options] = args
        return undiciFetch(url, {
          ...options,
          dispatcher: extendedTimeoutDispatcher,
        }) as unknown as Promise<Response>
      },
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
