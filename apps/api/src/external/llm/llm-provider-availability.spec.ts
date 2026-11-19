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
 *   node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --colors --runInBand --forceExit src/external/llm/llm-provider-availability
 *
 * Keep --experimental-vm-modules: the Google auth library loads its fetch
 * with a dynamic import, so without it every Vertex and Claude model fails
 * with "Unexpected Gaxios Error". `npm run test:win` lacks the flag.
 *
 * A model whose access is missing or broken fails: the goal is to see what is
 * wrong in the local setup, so nothing is skipped. At the end, a table lists
 * every model that ran, with its result, its time and the reason of a failure.
 */
const runAvailability = process.env.LLM_PROVIDER_AVAILABILITY_TEST === "true"
const describeAvailability = runAvailability ? describe : describe.skip

const AVAILABILITY_TIMEOUT_MS = 60_000
const SYSTEM_PROMPT = "Always return 42."
const QUESTION = "The Ultimate Question of Life, the Universe and Everything"

const DETAIL_MAX_LENGTH = 100

const testedModels = Object.values(AgentModel).filter((model) => model !== AgentModel._Mock)

type AvailabilityResult = {
  provider: string
  model: string
  available: boolean
  durationMs: number
  detail: string
}

/** One line: the error message, plus its cause, which holds the real reason of a Gaxios error. */
function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = error.cause instanceof Error ? ` (cause: ${error.cause.message})` : ""
  const detail = `${error.message}${cause}`.replace(/\s+/g, " ").trim()
  return detail.length > DETAIL_MAX_LENGTH ? `${detail.slice(0, DETAIL_MAX_LENGTH - 1)}…` : detail
}

/** A plain-text table of the results, in the order the models ran, and a summary line. */
function formatAvailabilityTable(results: AvailabilityResult[]): string {
  const header = ["Provider", "Model", "Result", "Time", "Detail"]
  const rows = results.map((result) => [
    result.provider,
    result.model,
    result.available ? "OK" : "FAILED",
    `${(result.durationMs / 1000).toFixed(1)} s`,
    result.detail,
  ])
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => (row[column] ?? "").length)),
  )
  const formatRow = (cells: string[]) =>
    cells
      .map((cell, column) => cell.padEnd(widths[column] ?? 0))
      .join(" | ")
      .trimEnd()
  const separator = widths.map((width) => "-".repeat(width)).join("-|-")
  const availableCount = results.filter((result) => result.available).length
  return [
    "",
    formatRow(header),
    separator,
    ...rows.map(formatRow),
    "",
    `${availableCount}/${results.length} models available`,
    "",
  ].join("\n")
}

describeAvailability("LLM provider availability (LOCAL)", () => {
  let providers: LlmProviders
  const results: AvailabilityResult[] = []

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [LlmModule] }).compile()
    providers = module.get<LlmProviders>(LLM_PROVIDERS)
  })

  // Written to stdout, not through console.log: Jest would add a stack trace under the table.
  afterAll(() => {
    if (results.length > 0) process.stdout.write(formatAvailabilityTable(results))
  })

  it.each(testedModels.map((model) => [AgentModelToAgentProvider[model], model]))(
    "%s / %s answers 42",
    async (agentProvider, model) => {
      const startedAt = Date.now()
      const record = (available: boolean, detail: string) =>
        results.push({
          provider: agentProvider,
          model,
          available,
          durationMs: Date.now() - startedAt,
          detail,
        })
      try {
        const answer = await askTheQuestion(agentProvider, model)
        expect(answer).toContain("42")
        record(true, "")
      } catch (error) {
        record(false, describeFailure(error))
        throw error
      }
    },
    AVAILABILITY_TIMEOUT_MS,
  )

  async function askTheQuestion(
    agentProvider: (typeof AgentModelToAgentProvider)[AgentModel],
    model: AgentModel,
  ): Promise<string> {
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

    return provider.generateText({
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
  }
})
