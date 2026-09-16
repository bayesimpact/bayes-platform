import "dotenv/config"
import { ToolName } from "@caseai-connect/api-contracts"
import { PROVIDER_CASES } from "./provider-cases"
import {
  HANDBOOK_CATEGORY_NAMES,
  HANDBOOK_DOCUMENT_ID,
  runRagTurnScenario,
} from "./turn-classification-scenario"

/**
 * Centralized LIVE reliability suite, one production-shaped RAG turn per
 * provider/model: the model must answer the user (grounded on the handbook
 * fixture), the sources must be logged EXACTLY once (from the inline
 * citations, or from the classifier's attribution when the model cited
 * nothing inline) and the session metadata must be recorded once.
 *
 * Run it with (NODE_OPTIONS required by google-auth dynamic imports):
 *
 *   LIVE_PROVIDER_REGRESSIONS=1 NODE_OPTIONS=--experimental-vm-modules \
 *     npx jest --runInBand --forceExit src/external/llm/providers/live-regressions
 */
const runLive = process.env.LIVE_PROVIDER_REGRESSIONS === "1"
const describeLive = runLive ? describe : describe.skip

const LIVE_TIMEOUT_MS = 180_000

describeLive("RAG turn: answer, sources and classification across providers (LIVE)", () => {
  for (const providerCase of PROVIDER_CASES) {
    const reason = runLive ? providerCase.unavailableReason() : null
    const testFn = reason ? it.skip : it

    testFn(
      `${providerCase.label}${reason ? ` — SKIPPED: ${reason}` : ""} — grounded answer, sources once, metadata once`,
      async () => {
        const { text, citedAliases, toolExecutions } = await runRagTurnScenario({
          provider: providerCase.buildProvider(),
          model: providerCase.model,
        })

        // The user got a grounded answer, with no citation marker left in it.
        expect(text.trim().length).toBeGreaterThan(0)
        expect(text).toContain("27")
        expect(text).not.toMatch(/\[\s*c\d+/i)

        const sourcesLogs = toolExecutions.filter(
          (toolExecution) => toolExecution.toolName === ToolName.Sources,
        )
        const metadataLogs = toolExecutions.filter(
          (toolExecution) =>
            toolExecution.toolName === ToolName.RecalculateConversationSessionMetadata,
        )
        expect(sourcesLogs).toHaveLength(1)
        const sources = sourcesLogs[0]?.arguments.sources as Array<{ documentId: string }>
        expect(sources[0]?.documentId).toBe(HANDBOOK_DOCUMENT_ID)

        expect(metadataLogs).toHaveLength(1)
        const categoryNames = metadataLogs[0]?.arguments.categoryNames as string[]
        for (const categoryName of categoryNames) {
          expect(HANDBOOK_CATEGORY_NAMES).toContain(categoryName)
        }

        // Observability, not a contract: how the sources were obtained.
        console.log(
          `[${providerCase.label}] sources via ${citedAliases.length > 0 ? `inline citations ${JSON.stringify(citedAliases)}` : "classifier attribution"}; title=${JSON.stringify(metadataLogs[0]?.arguments.suggestedTitle)} categories=${JSON.stringify(categoryNames)}`,
        )
      },
      LIVE_TIMEOUT_MS,
    )
  }
})
