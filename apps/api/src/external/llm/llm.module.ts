import { Module } from "@nestjs/common"
import { AISDKGemmaProvider } from "@/external/llm/providers/ai-sdk-gemma.provider"
import { AISDKMedGemmaProvider } from "@/external/llm/providers/ai-sdk-med-gemma.provider"
import { AISDKMockProvider } from "@/external/llm/providers/ai-sdk-mock.provider"
import { AISDKVertexProvider } from "@/external/llm/providers/ai-sdk-vertex.provider"

@Module({
  providers: [
    {
      provide: "VertexLLMProvider",
      useClass: AISDKVertexProvider,
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
  exports: ["MedGemmaLLMProvider", "GemmaLLMProvider", "VertexLLMProvider", "_MockLLMProvider"],
})
export class LlmModule {}
