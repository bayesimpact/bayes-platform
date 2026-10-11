import type { AgentProvider } from "@caseai-connect/api-contracts"
import { Agent, fetch as undiciFetch } from "undici"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { AISDKLLMModelMgmt } from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"

/**
 * The fetch a call reaches its model through: the global one, or one with
 * extended network timeouts for the long-running calls that opt in with
 * `config.useExtendedTimeouts` (e.g. extraction agent runs). Every provider
 * hands {@link fetchFor} (or {@link extendedTimeoutsFetch}) to the client it
 * builds, so none of them keeps the default timeouts on a long call.
 */
export abstract class AISDKLLMFetchMgmt<
  Provider extends AgentProvider = AgentProvider,
> extends AISDKLLMModelMgmt<Provider> {
  // Default network timeouts (ms) of the extended-timeout fetch when the
  // corresponding env vars are unset. Sized for long-running calls such as
  // extraction agent runs.
  private readonly defaultHeadersTimeoutMs = 30 * 60 * 1000 // 30 minutes
  private readonly defaultBodyTimeoutMs = 30 * 60 * 1000 // 30 minutes
  private readonly defaultConnectTimeoutMs = 30 * 1000 // 30 seconds

  private extendedTimeoutsDispatcher?: Agent

  /** The global fetch, read at call time so a fetch replaced later (a test spy) is the one used. */
  protected readonly defaultFetch: typeof globalThis.fetch = (input, init) =>
    globalThis.fetch(input, init)

  /** The fetch with extended network timeouts, through one dispatcher for the provider's lifetime. */
  protected readonly extendedTimeoutsFetch: typeof globalThis.fetch = (input, init) =>
    undiciFetch(input as Parameters<typeof undiciFetch>[0], {
      ...(init as Parameters<typeof undiciFetch>[1]),
      dispatcher: this.getExtendedTimeoutsDispatcher(),
    }) as unknown as Promise<Response>

  /** The fetch for this call: with extended timeouts when it opts in. */
  protected fetchFor(config: LLMConfig): typeof globalThis.fetch {
    return config.useExtendedTimeouts ? this.extendedTimeoutsFetch : this.defaultFetch
  }

  /**
   * Created on first use, so a provider that never runs a long call does not
   * hold one. The three timeouts are configurable through env vars.
   */
  private getExtendedTimeoutsDispatcher(): Agent {
    this.extendedTimeoutsDispatcher ??= new Agent({
      headersTimeout: this.readTimeoutMs(
        process.env.VERTEX_FETCH_HEADERS_TIMEOUT_MS,
        this.defaultHeadersTimeoutMs,
      ),
      bodyTimeout: this.readTimeoutMs(
        process.env.VERTEX_FETCH_BODY_TIMEOUT_MS,
        this.defaultBodyTimeoutMs,
      ),
      connectTimeout: this.readTimeoutMs(
        process.env.VERTEX_FETCH_CONNECT_TIMEOUT_MS,
        this.defaultConnectTimeoutMs,
      ),
    })
    return this.extendedTimeoutsDispatcher
  }

  private readTimeoutMs(value: string | undefined, defaultMs: number): number {
    if (!value) return defaultMs
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? defaultMs : parsed
  }
}
