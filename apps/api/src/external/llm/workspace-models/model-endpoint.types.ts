import type { LLMCallContext } from "@/common/interfaces/llm-provider.interface"

/**
 * The server a call to a self-hosted model goes to when the agent runs a model its workspace
 * added. Without an API key, the call keeps the key of the environment variables. Without a served
 * name, the server is asked for the model under the id of its type.
 */
export type ModelEndpointSettings = {
  url: string
  apiKey: string | null
  servedModelName: string | null
}

/** Finds the server of a call. Null means the environment variables of the model. */
export interface ModelEndpointResolver {
  resolveEndpoint(params: {
    callContext: LLMCallContext
    model: string
  }): Promise<ModelEndpointSettings | null>
}

/** The DI token of the {@link ModelEndpointResolver}, so the LLM providers import no service. */
export const MODEL_ENDPOINT_RESOLVER = "ModelEndpointResolver"
