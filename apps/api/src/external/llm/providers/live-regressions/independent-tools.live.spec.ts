import "dotenv/config"
import { ToolName } from "@caseai-connect/api-contracts"
import { runIndependentToolsScenario } from "./independent-tools-scenario"
import { PROVIDER_CASES } from "./provider-cases"

/**
 * LIVE: two independent tools (resource card + knowledge base lookup) on
 * one turn. The contract, with the production prompt: both tools run and
 * the answer is grounded. The number of generations (two when the model
 * groups both calls, three otherwise) and the effect of the candidate
 * grouped-calls line are measured and logged, not asserted: see the
 * scenario header for why the line is not in production.
 *
 *   LIVE_PROVIDER_REGRESSIONS=1 NODE_OPTIONS=--experimental-vm-modules \
 *     npx jest --runInBand --forceExit src/external/llm/providers/live-regressions
 */
const runLive = process.env.LIVE_PROVIDER_REGRESSIONS === "1"
const describeLive = runLive ? describe : describe.skip

const LIVE_TIMEOUT_MS = 240_000
// Measurement knob: vary the user message without editing the scenario.
const userMessage = process.env.INDEPENDENT_TOOLS_USER_MESSAGE

describeLive("Independent tools on one turn across providers (LIVE)", () => {
  for (const providerCase of PROVIDER_CASES) {
    const reason = runLive ? providerCase.unavailableReason() : null
    const testFn = reason ? it.skip : it

    testFn(
      `${providerCase.label}${reason ? ` — SKIPPED: ${reason}` : ""} — card AND lookup run, grounded answer`,
      async () => {
        const production = await runIndependentToolsScenario({
          provider: providerCase.buildProvider(),
          model: providerCase.model,
          groupedCallsInstruction: false,
          userMessage,
        })
        const candidate = await runIndependentToolsScenario({
          provider: providerCase.buildProvider(),
          model: providerCase.model,
          groupedCallsInstruction: true,
          userMessage,
        })
        const executed = (executions: typeof production.toolExecutions) =>
          executions.map((execution) => execution.toolName).sort()
        console.log(
          `[${providerCase.label}] generations production/candidate line: ${production.generations}/${candidate.generations}; tools ${JSON.stringify(executed(production.toolExecutions))} / ${JSON.stringify(executed(candidate.toolExecutions))}; sequence production ${JSON.stringify(production.toolResultsSeen)} candidate ${JSON.stringify(candidate.toolResultsSeen)}`,
        )

        expect(production.text.trim().length).toBeGreaterThan(0)
        expect(production.text).toContain("27")
        expect(executed(production.toolExecutions)).toEqual([
          ToolName.LookupKnowledgeBase,
          ToolName.SurfaceResources,
        ])
      },
      LIVE_TIMEOUT_MS,
    )
  }
})
