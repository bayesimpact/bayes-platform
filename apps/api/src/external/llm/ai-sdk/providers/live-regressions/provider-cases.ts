import { AgentModel } from "@caseai-connect/api-contracts"
import type { LLMProvider } from "@/common/interfaces/llm-provider.interface"
import { AISDKAnthropicProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-anthropic.provider"
import { AISDKGemmaProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-gemma.provider"
import { AISDKMedGemmaProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-med-gemma.provider"
import { AISDKMistralProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-mistral.provider"
import { AISDKOpenAIProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-openai.provider"
import { AISDKQwenProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-qwen.provider"
import { AISDKVertexProvider } from "@/external/llm/ai-sdk/providers/ai-sdk-vertex.provider"
import { AISDKVertex3Provider } from "@/external/llm/ai-sdk/providers/ai-sdk-vertex3.provider"

/**
 * The provider/model matrix shared by every live-regression spec in this
 * folder. A case is auto-skipped (with a visible reason) when its serving
 * env is absent: vLLM-backed models need their VLLM_<MODEL>_URL, Vertex
 * models need Google ADC credentials, OpenAI models need OPENAI_API_KEY.
 */
export type ProviderCase = {
  label: string
  model: AgentModel
  buildProvider: () => LLMProvider
  /** Returns a skip reason when the provider cannot be reached from here. */
  unavailableReason: () => string | null
}

const vllmUnavailableReason = (envKey: string) => () =>
  process.env[envKey] ? null : `${envKey} is not set`

export const PROVIDER_CASES: ProviderCase[] = [
  {
    label: "Gemma 4 26B (vLLM)",
    model: AgentModel.Gemma4_26B,
    buildProvider: () => new AISDKGemmaProvider(),
    unavailableReason: vllmUnavailableReason("VLLM_GEMMA4_26B_URL"),
  },
  {
    label: "Gemma 4 31B (vLLM)",
    model: AgentModel.Gemma4_31B,
    buildProvider: () => new AISDKGemmaProvider(),
    unavailableReason: vllmUnavailableReason("VLLM_GEMMA4_31B_URL"),
  },
  {
    label: "Gemini 3.8 Flash (Vertex3)",
    model: AgentModel.Gemini38Flash,
    buildProvider: () => new AISDKVertex3Provider(),
    unavailableReason: () => null,
  },
  {
    label: "Gemini 3.7 Flash (Vertex3)",
    model: AgentModel.Gemini37Flash,
    buildProvider: () => new AISDKVertex3Provider(),
    unavailableReason: () => null,
  },
  {
    label: "Gemini 3.6 Flash (Vertex3)",
    model: AgentModel.Gemini36Flash,
    buildProvider: () => new AISDKVertex3Provider(),
    unavailableReason: () => null,
  },
  {
    label: "Gemini 3.5 Flash (Vertex3)",
    model: AgentModel.Gemini35Flash,
    buildProvider: () => new AISDKVertex3Provider(),
    // Re-enable once the Vertex quota blown by measurement sessions resets.
    unavailableReason: () => "temporarily disabled (Vertex quota)",
  },
  {
    label: "Gemini 3.5 Flash Lite (Vertex3)",
    model: AgentModel.Gemini35FlashLite,
    buildProvider: () => new AISDKVertex3Provider(),
    unavailableReason: () => null,
  },
  {
    label: "Gemini 3.1 Flash Lite (Vertex3)",
    model: AgentModel.Gemini31FlashLite,
    buildProvider: () => new AISDKVertex3Provider(),
    unavailableReason: () => null,
  },
  {
    label: "Gemini 2.5 Flash (Vertex)",
    model: AgentModel.Gemini25Flash,
    buildProvider: () => new AISDKVertexProvider(),
    unavailableReason: () => null,
  },
  {
    label: "Mistral Small 3.2 24B (vLLM)",
    model: AgentModel.MistralSmall32_24B,
    buildProvider: () => new AISDKMistralProvider(),
    unavailableReason: vllmUnavailableReason("VLLM_MISTRALSMALL32_24B_URL"),
  },
  {
    label: "Qwen3.8 27B (vLLM)",
    model: AgentModel.Qwen38_27B,
    buildProvider: () => new AISDKQwenProvider(),
    unavailableReason: vllmUnavailableReason("VLLM_QWEN38_27B_URL"),
  },
  {
    label: "MedGemma 27B (vLLM, custom prompt-based tools)",
    model: AgentModel.MedGemma10_27B,
    buildProvider: () => new AISDKMedGemmaProvider(),
    unavailableReason: vllmUnavailableReason("VLLM_MEDGEMMA10_27B_URL"),
  },
  {
    label: "Claude Sonnet 5.5 (Vertex, eu)",
    model: AgentModel.ClaudeSonnet55,
    buildProvider: () => new AISDKAnthropicProvider(),
    // Re-enable once Claude has a quota in the Model Garden of the project.
    unavailableReason: () => "temporarily disabled (no Vertex quota for Claude)",
  },
  {
    label: "Claude Haiku 5.5 (Vertex, eu)",
    model: AgentModel.ClaudeHaiku55,
    buildProvider: () => new AISDKAnthropicProvider(),
    unavailableReason: () => "temporarily disabled (no Vertex quota for Claude)",
  },
  {
    label: "Claude Opus 5 (Vertex, eu)",
    model: AgentModel.ClaudeOpus5,
    buildProvider: () => new AISDKAnthropicProvider(),
    unavailableReason: () => "temporarily disabled (no Vertex quota for Claude)",
  },
  {
    label: "GPT-5.4 (OpenAI)",
    model: AgentModel.Gpt54,
    buildProvider: () => new AISDKOpenAIProvider(),
    unavailableReason: () => (process.env.OPENAI_API_KEY ? null : "OPENAI_API_KEY is not set"),
  },
  {
    label: "GPT-5.4 mini (OpenAI)",
    model: AgentModel.Gpt54Mini,
    buildProvider: () => new AISDKOpenAIProvider(),
    unavailableReason: () => (process.env.OPENAI_API_KEY ? null : "OPENAI_API_KEY is not set"),
  },
]
