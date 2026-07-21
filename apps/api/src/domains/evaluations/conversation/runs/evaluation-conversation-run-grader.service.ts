import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { Inject, Injectable, UnprocessableEntityException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { LLMMetadata, LLMProvider } from "@/common/interfaces/llm-provider.interface"
import { ServiceWithLLM } from "@/external/llm"

/**
 * LLM judge for conversation evaluation runs, ported from the legacy
 * EvaluationReportsService.rateReport: same prompts, same rating agent at
 * temperature 0, same mock swap for tests. The judge model is now selectable
 * per run (defaulting to Gemini 2.5 Flash) and passed in via `judgeModel`.
 * Unlike the legacy version, the raw response is parsed into an integer score
 * clamped to 0-5 and an unparsable response throws (the run record then becomes
 * status "error").
 */
@Injectable()
export class EvaluationConversationRunGraderService extends ServiceWithLLM {
  constructor(
    @Inject("_MockLLMProvider")
    mockLlmProvider: LLMProvider,
    @Inject("VertexLLMProvider")
    vertexLlmProvider: LLMProvider,
    @Inject("Vertex3LLMProvider")
    vertex3LlmProvider: LLMProvider,
    @Inject("MistralLLMProvider")
    mistralLlmProvider: LLMProvider,
    @Inject("MedGemmaLLMProvider")
    medGemmaLlmProvider: LLMProvider,
    @Inject("GemmaLLMProvider")
    gemmaLlmProvider: LLMProvider,
  ) {
    super({
      mockLlmProvider,
      vertexLlmProvider,
      vertex3LlmProvider,
      medGemmaLlmProvider,
      gemmaLlmProvider,
      mistralLlmProvider,
    })
  }

  async gradeOutput({
    expectedOutput,
    generatedOutput,
    generatorModel,
    judgeModel,
    traceId,
    connectScope,
  }: {
    expectedOutput: string
    generatedOutput: string
    generatorModel: AgentModel
    judgeModel: AgentModel
    traceId: string
    connectScope: RequiredConnectScope
  }): Promise<number> {
    const ratingAgent = {
      systemPrompt: `
 You are a rating agent. Your job is to evaluate a string value and return a score from 0 to 5.
 The string value is '%value'.
 The instructions to do the rating are '%ratingInstructions'
 You have to consider the '%ratingInstructions' and only them to evaluate the '%value'
 Your rating rules are the following:
    - return a value between 0 and 5, step 1
    - 5 is the maximum and signify that the '%value' completely satisfies the '%ratingInstructions'.
    - 0 signifies that the '%value' is fully far away the '%ratingInstructions'.
`,
      model: judgeModel,
      temperature: 0,
    }

    const llmMetadata: LLMMetadata = {
      traceId,
      agentSessionId: traceId,
      currentTurn: 1,
      agentId: "Custom-Rating-Agent",
      revision: 0,
      projectId: connectScope.projectId,
      organizationId: connectScope.organizationId,
      tags: ["*Rating Agent*"],
    }

    //fixme: remove when specific agent for rating(in db) for rating with mock
    if (AgentModelToAgentProvider[generatorModel] === AgentProvider._Mock) {
      ratingAgent.model = AgentModel._Mock
      llmMetadata.tags.unshift("**TEST**")
    }

    const llmConfig = this.buildLLMConfig(ratingAgent)

    const response = await this.getProviderForModel(llmConfig.model).generateText({
      prompt: `
<%ratingInstructions>
${expectedOutput}
<%/ratingInstructions>

<%value>
${generatedOutput}
</%value>

return only the rating value (0 to 5), no sentence`,
      config: llmConfig,
      metadata: llmMetadata,
    })

    return this.parseScore(response)
  }

  private parseScore(response: string): number {
    const parsedScore = Number.parseFloat(response.trim())
    if (Number.isNaN(parsedScore)) {
      throw new UnprocessableEntityException(
        `Rating agent returned an unparsable score: "${response}"`,
      )
    }
    return Math.min(5, Math.max(0, Math.round(parsedScore)))
  }
}
