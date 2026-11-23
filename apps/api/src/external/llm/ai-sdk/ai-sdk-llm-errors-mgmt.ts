import { APICallError } from "@ai-sdk/provider"
import type { AgentProvider } from "@caseai-connect/api-contracts"
import { context, trace } from "@opentelemetry/api"
import { RetryError } from "ai"
import type { LLMConfig } from "@/common/interfaces/llm-provider.interface"
import { randomSleep, sleep } from "@/common/utils/sleep"
import type { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import { AISDKLLMFetchMgmt } from "@/external/llm/ai-sdk/ai-sdk-llm-fetch-mgmt"

const CLIENT_TIMEOUT_ERROR_CODES = ["UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]
const CONNECT_TIMEOUT_ERROR_CODES = ["UND_ERR_CONNECT_TIMEOUT"]

type RetriableError =
  | { retry: true; reason: "CONNECT_TIMEOUT" | "CLIENT_TIMEOUT" | "ERROR_429"; delay: number }
  | { retry: false }

type RetryEvent =
  | {
      name: "retry"
      attributes: { "retry.attempt": string; "retry.reason": string; "retry.message": string }
    }
  | { name: "retry-info"; attributes: { "retry-info.message": string } }

/** Every error reachable from `error` through `cause` and `RetryError.errors`. */
export function flattenErrorGraph(error: unknown, seen = new Set<unknown>()): unknown[] {
  if (error === null || typeof error !== "object" || seen.has(error)) return []
  seen.add(error)
  const reachable: unknown[] = [error]
  if (RetryError.isInstance(error)) {
    for (const nestedError of error.errors) reachable.push(...flattenErrorGraph(nestedError, seen))
  }
  const { cause } = error as { cause?: unknown }
  reachable.push(...flattenErrorGraph(cause, seen))
  return reachable
}

function hasErrorCode(error: unknown, codes: string[]): boolean {
  const { code } = (error ?? {}) as { code?: unknown }
  return typeof code === "string" && codes.includes(code)
}

function randomDelay(msMin: number, msMax: number): number {
  return Math.floor(Math.random() * (msMax - msMin)) + msMin
}

/**
 * The errors worth retrying: a connection or a response that timed out, and a
 * 429 (the provider has no capacity left, which is how a flex call fails on
 * both Vertex AI and OpenAI). Anything else (a 400, an invalid output) would
 * fail the same way again.
 */
function classifyError(error: unknown): RetriableError {
  const allErrors = flattenErrorGraph(error)
  if (allErrors.some((nested) => hasErrorCode(nested, CONNECT_TIMEOUT_ERROR_CODES)))
    return { retry: true, reason: "CONNECT_TIMEOUT", delay: randomDelay(2000, 10000) }
  if (allErrors.some((nested) => hasErrorCode(nested, CLIENT_TIMEOUT_ERROR_CODES)))
    return { retry: true, reason: "CLIENT_TIMEOUT", delay: randomDelay(200, 5000) }
  if (allErrors.some((nested) => APICallError.isInstance(nested) && nested.statusCode === 429))
    return { retry: true, reason: "ERROR_429", delay: randomDelay(2000, 10000) }
  return { retry: false }
}

/**
 * Retries managed by the provider, for the calls that ask for them
 * (`nbRetriesOnSpecificErrors`): only the errors worth retrying are retried,
 * with a random wait between attempts. A flex call with no capacity left
 * after its retries runs once on the standard tier when
 * `fallbackToStandardTier` is set. Each retry is an event on the active span.
 */
export abstract class AISDKLLMErrorsMgmt<
  Provider extends AgentProvider = AgentProvider,
> extends AISDKLLMFetchMgmt<Provider> {
  protected async withRetryOnSpecificErrors<T>({
    config,
    callOrigin,
    call,
  }: {
    config: LLMConfig
    callOrigin: CallOrigin
    call: (config: LLMConfig) => Promise<T>
  }): Promise<T> {
    const nbRetries = config.nbRetriesOnSpecificErrors ?? 0
    const fallsBackToStandardTier = config.serviceTier === "flex" && config.fallbackToStandardTier
    if (nbRetries === 0 && !fallsBackToStandardTier) return call(config)

    const messageSuffix = `${callOrigin}:${config.model} with serviceTier: ${config.serviceTier ?? "<undefined>"}`
    const maxAttempts = 1 + nbRetries
    let lastError: unknown
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await call(config)
      } catch (error) {
        const retriableError = classifyError(error)
        if (!retriableError.retry) throw error
        lastError = error
        const isLastAttempt = attempt === maxAttempts
        this.addRetryEvent({
          name: "retry",
          attributes: {
            "retry.reason": retriableError.reason,
            "retry.attempt": `current attempt ${attempt}/${maxAttempts}`,
            "retry.message": `${messageSuffix} : ${isLastAttempt ? "retry limit reached, finishing process" : "retrying"}`,
          },
        })
        if (!isLastAttempt) await sleep(retriableError.delay)
      }
    }

    if (config.serviceTier === "flex") {
      if (!config.fallbackToStandardTier) {
        this.addRetryEvent({
          name: "retry-info",
          attributes: {
            "retry-info.message": `${messageSuffix} : no fallback to standard-tier set, returning error after ${maxAttempts} attempt(s)`,
          },
        })
        throw lastError
      }
      this.addRetryEvent({
        name: "retry-info",
        attributes: {
          "retry-info.message": `${messageSuffix} : no flex capacity after ${maxAttempts} attempt(s), falling back to the standard tier with no retry`,
        },
      })
      await randomSleep(1000, 5000)
      return call({
        ...config,
        serviceTier: undefined,
        nbRetriesOnSpecificErrors: 0,
        fallbackToStandardTier: false,
        forceNoRetry: true,
      } as LLMConfig)
    }
    this.addRetryEvent({
      name: "retry-info",
      attributes: {
        "retry-info.message": `${messageSuffix} : returning error after ${maxAttempts} attempt(s)`,
      },
    })
    throw lastError
  }

  /**
   * The AI SDK's own retries (2 by default) retry every error, an invalid
   * output included: they are turned off when the provider manages the retries.
   */
  protected getMaxRetries(config: LLMConfig): number | undefined {
    if ((config.nbRetriesOnSpecificErrors ?? 0) > 0 || config.forceNoRetry) return 0
    return undefined
  }

  private addRetryEvent(event: RetryEvent): void {
    trace.getSpan(context.active())?.addEvent(event.name, event.attributes)
  }
}
