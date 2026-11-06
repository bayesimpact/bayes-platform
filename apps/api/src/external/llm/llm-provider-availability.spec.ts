import { AgentModel, AgentModelToAgentProvider } from "@caseai-connect/api-contracts"
import { Test } from "@nestjs/testing"
import { v4 } from "uuid"
import type { LLMCallContext } from "@/common/interfaces/llm-provider.interface"
import { LLM_PROVIDERS, LlmModule, type LlmProviders } from "@/external/llm/llm.module"
import { telemetryAdditionalMetadata } from "@/external/llm/telemetry/telemetry-additional-metadata"

/**
 * LOCAL ONLY: checks that every model of every provider answers with the
 * connections and credentials configured in `.env.test` (VLLM_<MODEL>_URL and
 * VLLM_<MODEL>_APIKEY, GOOGLE_APPLICATION_CREDENTIALS, OPENAI_API_KEY...).
 * Enable it with LLM_PROVIDER_AVAILABILITY_TEST=true in `.env.test`, then:
 *
 *   npx jest --colors --runInBand --forceExit src/external/llm/llm-provider-availability
 *
 * A model whose access is missing or broken fails: the goal is to see what is
 * wrong in the local setup, so nothing is skipped.
 */
const runAvailability = process.env.LLM_PROVIDER_AVAILABILITY_TEST === "true"
const describeAvailability = runAvailability ? describe : describe.skip

const AVAILABILITY_TIMEOUT_MS = 60_000
const SYSTEM_PROMPT = "Always return 42."
const QUESTION = "The Ultimate Question of Life, the Universe and Everything"

const testedModels = Object.values(AgentModel).filter((model) => model !== AgentModel._Mock)

describeAvailability("LLM provider availability (LOCAL)", () => {
  let providers: LlmProviders

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [LlmModule] }).compile()
    providers = module.get<LlmProviders>(LLM_PROVIDERS)
  })

  it.each(testedModels.map((model) => [AgentModelToAgentProvider[model], model]))(
    "%s / %s answers 42",
    async (agentProvider, model) => {
      const provider = providers[agentProvider]
      const callContext: LLMCallContext = {
        traceId: v4(),
        agentSessionId: "llm-provider-availability-session",
        currentTurn: 1,
        organizationId: "llm-provider-availability-organization",
        projectId: "llm-provider-availability-project",
        agentId: "llm-provider-availability-agent",
        revision: 1,
      }

      const answer = await provider.generateText({
        prompt: QUESTION,
        config: {
          model,
          systemPrompt: SYSTEM_PROMPT,
          modelOptions: provider.getInternalCallModelOptions(model),
          serviceTier: undefined,
        },
        callContext,
        additionalMetadata: telemetryAdditionalMetadata({
          model,
          test: { name: "llm-provider-availability", case: model },
        }),
      })

      expect(answer).toContain("42")
    },
    AVAILABILITY_TIMEOUT_MS,
  )
})
