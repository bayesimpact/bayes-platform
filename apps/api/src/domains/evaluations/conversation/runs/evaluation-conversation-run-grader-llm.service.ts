import { AgentModel, AgentModelToAgentProvider, AgentProvider } from "@caseai-connect/api-contracts"
import { Inject, Injectable, UnprocessableEntityException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { LLMCallContext } from "@/common/interfaces/llm-provider.interface"
import { LlmServiceBase } from "@/external/llm"
import { buildAdditionalMetadata } from "@/external/llm/additional-metadata"
import { LLM_PROVIDERS, type LlmProviders } from "@/external/llm/llm.module"

/**
 * LLM judge for conversation evaluation runs, ported from the legacy
 * EvaluationReportsService.rateReport: same prompts, same rating agent at
 * temperature 0, same mock swap for tests. The judge model is now selectable
 * per run (see AGENT_DEFAULT_MODELS.judge for the default the UI offers) and passed in via
 * optional per-run `judgeInstructions` are injected into the grading prompt.
 * Unlike the legacy version, the raw response is parsed into an integer score
 * clamped to 0-5 and an unparsable response throws (the run record then becomes
 * status "error").
 */
@Injectable()
export class EvaluationConversationRunGraderLlmService extends LlmServiceBase {
  constructor(
    @Inject(LLM_PROVIDERS)
    llmProviders: LlmProviders,
  ) {
    super(llmProviders)
  }

  async gradeOutput({
    expectedOutput,
    generatedOutput,
    generatorModel,
    judgeModel,
    judgeInstructions,
    traceId,
    connectScope,
  }: {
    expectedOutput: string
    generatedOutput: string
    generatorModel: AgentModel
    judgeModel: AgentModel
    judgeInstructions?: string | null
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
${
  judgeInstructions
    ? ` Additional judge instructions may be provided in '%judgeInstructions'; apply them on top of the '%ratingInstructions' when rating.
`
    : ""
}`,
      model: judgeModel,
      modelOptions: { temperature: 0 },
      priorityCallsEnabled: false,
      llmFeatures: { priorityCalls: false, flexWorkers: false },
    }

    const callContext: LLMCallContext = {
      traceId,
      agentSessionId: traceId,
      currentTurn: 1,
      agentId: "Custom-Rating-Agent",
      revision: 0,
      projectId: connectScope.projectId,
      organizationId: connectScope.organizationId,
      spanLabel: "grading",
    }
    //fixme: remove when specific agent for rating(in db) for rating with mock
    const generatedByMock = AgentModelToAgentProvider[generatorModel] === AgentProvider._Mock
    if (generatedByMock) ratingAgent.model = AgentModel._Mock
    const additionalMetadata = buildAdditionalMetadata({
      agent: { type: "Rating Agent" },
      environment: generatedByMock ? "**TEST**" : undefined,
    })

    const provider = this.getProviderForModel(ratingAgent.model)
    const llmConfig = this.buildLLMConfig({
      ...ratingAgent,
      modelOptions: provider.getInternalCallModelOptions(ratingAgent.model),
    })

    const response = await provider.generateText({
      prompt: `
<%ratingInstructions>
${expectedOutput}
<%/ratingInstructions>
${
  judgeInstructions
    ? `
<%judgeInstructions>
${judgeInstructions}
</%judgeInstructions>
`
    : ""
}
<%value>
${generatedOutput}
</%value>

return only the rating value (0 to 5), no sentence`,
      config: llmConfig,
      callContext: callContext,
      additionalMetadata,
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
