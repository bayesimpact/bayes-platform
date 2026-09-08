import { AgentModel } from "@caseai-connect/api-contracts"
import type { LLMProvider } from "@/common/interfaces/llm-provider.interface"
import { AISDKGemmaProvider } from "@/external/llm/providers/ai-sdk-gemma.provider"
import { AISDKMedGemmaProvider } from "@/external/llm/providers/ai-sdk-med-gemma.provider"
import { AISDKMistralProvider } from "@/external/llm/providers/ai-sdk-mistral.provider"
import { AISDKVertexProvider } from "@/external/llm/providers/ai-sdk-vertex.provider"
import { AISDKVertex3Provider } from "@/external/llm/providers/ai-sdk-vertex3.provider"

/**
 * The provider/model matrix shared by every live-regression spec in this
 * folder. A case is auto-skipped (with a visible reason) when its serving
 * env is absent: vLLM-backed models need their VLLM_<MODEL>_URL, Vertex
 * models need Google ADC credentials.
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
    label: "Mistral Small 3.1 24B (vLLM)",
    model: AgentModel.MistralSmall31_24B,
    buildProvider: () => new AISDKMistralProvider(),
    unavailableReason: vllmUnavailableReason("VLLM_MISTRALSMALL31_24B_URL"),
  },
  {
    label: "MedGemma 27B (vLLM, custom prompt-based tools)",
    model: AgentModel.MedGemma10_27B,
    buildProvider: () => new AISDKMedGemmaProvider(),
    unavailableReason: vllmUnavailableReason("VLLM_MEDGEMMA10_27B_URL"),
  },
]
