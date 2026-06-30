import { Module } from "@nestjs/common"
import { AISDKGemmaProvider } from "@/external/llm/providers/ai-sdk-gemma.provider"
import { AISDKMedGemmaProvider } from "@/external/llm/providers/ai-sdk-med-gemma.provider"
import { AISDKMistralProvider } from "@/external/llm/providers/ai-sdk-mistral.provider"
import { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"
import { AISDKVertexProvider } from "@/external/llm/providers/ai-sdk-vertex.provider"
import { AISDKVertex3Provider } from "@/external/llm/providers/ai-sdk-vertex3.provider"

@Module({
  providers: [
    {
      provide: "VertexLLMProvider",
      useClass: AISDKVertexProvider,
    },
    {
      provide: "Vertex3LLMProvider",
      useClass: AISDKVertex3Provider,
    },
    {
      provide: "MistralLLMProvider",
      useClass: AISDKMistralProvider,
    },
    {
      provide: "MedGemmaLLMProvider",
      useClass: AISDKMedGemmaProvider,
    },
    {
      provide: "GemmaLLMProvider",
      useClass: AISDKGemmaProvider,
    },
    {
      provide: "_MockLLMProvider",
      useClass: AISDKMockProvider,
    },
  ],
  exports: [
    "MedGemmaLLMProvider",
    "GemmaLLMProvider",
    "VertexLLMProvider",
    "Vertex3LLMProvider",
    "MistralLLMProvider",
    "_MockLLMProvider",
  ],
})
export class LlmModule {}
