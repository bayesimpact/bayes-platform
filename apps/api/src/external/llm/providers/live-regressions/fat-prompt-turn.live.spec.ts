import "dotenv/config"
import { ToolName } from "@caseai-connect/api-contracts"
import { PROVIDER_CASES } from "./provider-cases"
import { FAT_AGENT_CATEGORY_NAMES, runFatPromptTurnScenario } from "./turn-classification-scenario"

/**
 * LIVE no-RAG reliability suite on the anonymized fat-prompt agent (whole
 * referential in a ~9k-token system prompt, no tool at all, strict guardrails
 * with a quoted refusal sentence), across every provider/model.
 *
 * The contract is the same on every case: the user gets an answer AND the
 * session classification (title, categories from the closed list) is
 * recorded exactly once, whatever the answering model did.
 *
 *   LIVE_PROVIDER_REGRESSIONS=1 NODE_OPTIONS=--experimental-vm-modules \
 *     npx jest --runInBand --forceExit src/external/llm/providers/live-regressions
 */
const runLive = process.env.LIVE_PROVIDER_REGRESSIONS === "1"
const describeLive = runLive ? describe : describe.skip

const LIVE_TIMEOUT_MS = 180_000

const USER_MESSAGE_CASES: Array<{ label: string; userMessage: string; expectsTitle: boolean }> = [
  { label: "greeting turn", userMessage: "hello", expectsTitle: false },
  {
    label: "in-scope service question (link-format rules active)",
    userMessage: "how do I change my password?",
    expectsTitle: true,
  },
  {
    label: "strict-refusal trigger (personal file request)",
    userMessage: "exactly how much will I receive in allowances this month?",
    expectsTitle: true,
  },
  // A joke request has nothing to name: null is a legitimate title here.
  { label: "off-topic question", userMessage: "tell me a joke", expectsTitle: false },
]

describeLive("Fat-prompt (no RAG) turn classification across providers (LIVE)", () => {
  for (const providerCase of PROVIDER_CASES) {
    const reason = runLive ? providerCase.unavailableReason() : null
    const testFn = reason ? it.skip : it

    for (const userMessageCase of USER_MESSAGE_CASES) {
      testFn(
        `${providerCase.label}${reason ? ` — SKIPPED: ${reason}` : ""} — ${userMessageCase.label} — answers AND classifies once`,
        async () => {
          const { text, toolExecutions } = await runFatPromptTurnScenario({
            provider: providerCase.buildProvider(),
            model: providerCase.model,
            userMessage: userMessageCase.userMessage,
          })

          expect(text.trim().length).toBeGreaterThan(0)

          const metadataLogs = toolExecutions.filter(
            (toolExecution) =>
              toolExecution.toolName === ToolName.RecalculateConversationSessionMetadata,
          )
          expect(metadataLogs).toHaveLength(1)
          const categoryNames = metadataLogs[0]?.arguments.categoryNames as string[]
          for (const categoryName of categoryNames) {
            expect(FAT_AGENT_CATEGORY_NAMES).toContain(categoryName)
          }
          if (userMessageCase.expectsTitle) {
            expect(typeof metadataLogs[0]?.arguments.suggestedTitle).toBe("string")
          }
          console.log(
            `[${providerCase.label}] ${userMessageCase.label}: title=${JSON.stringify(metadataLogs[0]?.arguments.suggestedTitle)} categories=${JSON.stringify(categoryNames)}`,
          )
        },
        LIVE_TIMEOUT_MS,
      )
    }
  }
})
