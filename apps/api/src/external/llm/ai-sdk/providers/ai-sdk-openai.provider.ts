import { createOpenAI } from "@ai-sdk/openai"
import { AgentModel, type AgentModelOf, AgentProvider } from "@caseai-connect/api-contracts"
import { Injectable } from "@nestjs/common"
import type { LanguageModel } from "ai"
import { z } from "zod"
import type {
  LLMConfig,
  LLMModelOptions,
  ModelMetadata,
} from "@/common/interfaces/llm-provider.interface"
import type { SpecificProviderOptions } from "@/external/llm/ai-sdk/ai-sdk-llm-builders"
import type { CallOrigin } from "@/external/llm/ai-sdk/ai-sdk-llm-common"
import {
  defineModelOptions,
  type ModelInfos,
  type ModelOptions,
} from "@/external/llm/ai-sdk/ai-sdk-llm-model-mgmt"
import { AISDKLLMProviderBase } from "@/external/llm/ai-sdk/ai-sdk-llm-provider-base"

type OpenAIAgentModel = AgentModelOf<AgentProvider.OpenAI>

/** The reasoning efforts GPT-5.4 accepts. */
const reasoningEffortSchema = z.enum(["none", "low", "medium", "high"])
type OpenAIReasoningEffort = z.infer<typeof reasoningEffortSchema>

/** "low" keeps the latency of a chat turn close to the one of a flash model. */
const DEFAULT_REASONING_EFFORT: OpenAIReasoningEffort = "low"

type OpenAIOptions = { reasoningEffort: OpenAIReasoningEffort }

/** A reasoning effort and no temperature: GPT-5.x reasoning models reject one. */
const openAIModelOptions = () =>
  defineModelOptions(
    z.object({
      providerOptions: z.object({
        openai: z.object({ reasoningEffort: reasoningEffortSchema }),
      }),
    }),
    { providerOptions: { openai: { reasoningEffort: DEFAULT_REASONING_EFFORT } } },
  )

/**
 * OpenAI models, called on the standard OpenAI API (api.openai.com) with
 * OPENAI_API_KEY. OpenAI does not process the data in the EU: every model is
 * flagged `servedOutsideEu`, and the model pickers label it.
 */
@Injectable()
export class AISDKOpenAIProvider extends AISDKLLMProviderBase<AgentProvider.OpenAI> {
  getAgentProvider(): AgentProvider.OpenAI {
    return AgentProvider.OpenAI
  }

  protected readonly modelOptions: Record<OpenAIAgentModel, ModelOptions> = {
    [AgentModel.Gpt54]: openAIModelOptions(),
    [AgentModel.Gpt54Mini]: openAIModelOptions(),
  }
  protected readonly modelInfos: Record<OpenAIAgentModel, ModelInfos> = {
    [AgentModel.Gpt54]: { servedOutsideEu: true },
    [AgentModel.Gpt54Mini]: { servedOutsideEu: true },
  }

  // The API key is read on each call, so the API starts without one.
  private readonly openAIProvider = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  private readonly openAIProviderWithExtendedTimeouts = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    fetch: this.extendedTimeoutsFetch,
  })

  getLanguageModel({ config }: { config: LLMConfig; callOrigin: CallOrigin }): LanguageModel {
    const provider = config.useExtendedTimeouts
      ? this.openAIProviderWithExtendedTimeouts
      : this.openAIProvider
    return provider.responses(config.model)
  }

  /**
   * The agent's options, plus two settings of every call that are not the
   * agent's: `store: false` keeps the conversation out of OpenAI's response
   * storage, and the encrypted reasoning is sent back instead, so that a tool
   * loop keeps the model's reasoning.
   */
  protected override buildSpecificProviderOptions({
    config,
  }: {
    config: LLMConfig
  }): SpecificProviderOptions {
    const values = super.buildSpecificProviderOptions({ config })
    const { openai } = values.providerOptions as { openai: OpenAIOptions }
    return {
      ...values,
      providerOptions: {
        openai: { ...openai, store: false, include: ["reasoning.encrypted_content"] },
      },
    }
  }

  /** Nothing: an internal call runs on the model's defaults, as GPT-5.x takes no temperature. */
  override getInternalCallModelOptions(_agentModel: AgentModel): LLMModelOptions {
    return {}
  }

  override getModelMetadata(config: LLMConfig): ModelMetadata {
    const stored = (
      config.modelOptions?.providerOptions as { openai?: { reasoningEffort?: unknown } } | undefined
    )?.openai?.reasoningEffort
    // An effort the model does not take is not sent: the call falls back to
    // the default, and the metadata reports the effort actually sent.
    const parsed = reasoningEffortSchema.safeParse(stored)
    const reasoningEffort = parsed.success ? parsed.data : DEFAULT_REASONING_EFFORT
    // The reasoning effort is OpenAI's thinking level: one attribute for both.
    return { ...super.getModelMetadata(config), thinkingLevel: reasoningEffort.toUpperCase() }
  }
}
