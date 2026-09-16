/**
 * MANUAL measurement harness — makes LIVE LLM calls. Never wire this into
 * jest or CI: it is a plain ts-node script, deliberately NOT a *.spec.ts.
 *
 * The contract suites assert outcomes (sources logged once, metadata once);
 * this script measures HOW the outcome was reached over repeated attempts,
 * since temperature 0 is not deterministic on these providers:
 *
 * - "rag": how often the model cites its sources INLINE (zero extra cost)
 *   versus the classifier having to attribute them, how often the answer is
 *   grounded (contains the fixture value), and the classified categories.
 * - "fat": how often the classifier produces a title and in-list categories
 *   on the no-RAG fat prompt (greeting, service question, refusal, off-topic).
 *
 * Usage (from apps/api, NODE_OPTIONS required by google-auth):
 *
 *   NODE_OPTIONS=--experimental-vm-modules npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     src/external/llm/providers/live-regressions/measure-citation-rate.ts \
 *     --model gemini-3.6-flash --scenario rag --attempts 5
 */
import "dotenv/config"
import { ToolName } from "@caseai-connect/api-contracts"
import type { ToolExecutionLog } from "@/domains/agents/shared/agent-session-messages/streaming/tools/tool-execution-log"
import { PROVIDER_CASES } from "./provider-cases"
import { runFatPromptTurnScenario, runRagTurnScenario } from "./turn-classification-scenario"

type ScenarioName = "fat" | "rag"

function argValue(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag)
  return index !== -1 && process.argv[index + 1] ? (process.argv[index + 1] as string) : fallback
}

const modelId = argValue("--model", "gemini-3.6-flash")
const scenarioName = argValue("--scenario", "rag") as ScenarioName
const attempts = Number.parseInt(argValue("--attempts", "3"), 10)

const RAG_CASES = [
  { label: "document question", userMessage: "how many days of paid leave am I entitled to?" },
  { label: "greeting", userMessage: "hello" },
]
const FAT_CASES = [
  { label: "greeting", userMessage: "hello" },
  { label: "thanks", userMessage: "merci beaucoup !" },
  { label: "service question", userMessage: "how do I change my password?" },
  {
    label: "strict refusal",
    userMessage: "exactly how much will I receive in allowances this month?",
  },
  { label: "off-topic", userMessage: "tell me a joke" },
]

function metadataLog(toolExecutions: ToolExecutionLog[]) {
  return toolExecutions.find(
    (toolExecution) => toolExecution.toolName === ToolName.RecalculateConversationSessionMetadata,
  )
}

async function main() {
  const providerCase = PROVIDER_CASES.find((candidate) => candidate.model === modelId)
  if (!providerCase) {
    throw new Error(
      `No provider case for ${modelId}. Known models: ${PROVIDER_CASES.map((candidate) => candidate.model).join(", ")}`,
    )
  }
  const unavailableReason = providerCase.unavailableReason()
  if (unavailableReason) throw new Error(`${providerCase.label} unavailable: ${unavailableReason}`)
  const provider = providerCase.buildProvider()

  console.log(`model=${modelId} scenario=${scenarioName} attempts=${attempts}\n`)
  const cases = scenarioName === "rag" ? RAG_CASES : FAT_CASES
  for (const scenarioCase of cases) {
    let answered = 0
    let grounded = 0
    let inlineCited = 0
    let sourcesLogged = 0
    let titled = 0
    let classified = 0
    let errors = 0
    const categorySets: string[] = []
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const outcome =
          scenarioName === "rag"
            ? await runRagTurnScenario({
                provider,
                model: modelId,
                userMessage: scenarioCase.userMessage,
              })
            : await runFatPromptTurnScenario({
                provider,
                model: modelId,
                userMessage: scenarioCase.userMessage,
              })
        if (outcome.text.trim().length > 0) answered++
        if (outcome.text.includes("27")) grounded++
        if (outcome.citedAliases.length > 0) inlineCited++
        if (outcome.toolExecutions.some((execution) => execution.toolName === ToolName.Sources)) {
          sourcesLogged++
        }
        const metadata = metadataLog(outcome.toolExecutions)
        if (metadata) classified++
        if (typeof metadata?.arguments.suggestedTitle === "string") titled++
        categorySets.push(JSON.stringify(metadata?.arguments.categoryNames ?? null))
      } catch (error) {
        errors++
        console.log(`  [${scenarioCase.label}] ERROR: ${(error as Error).message?.slice(0, 120)}`)
      }
    }
    const total = attempts - errors
    const ragInfo =
      scenarioName === "rag"
        ? ` grounded=${grounded}/${total} inline=${inlineCited}/${total} sources=${sourcesLogged}/${total}`
        : ""
    console.log(
      `[${scenarioCase.label}] answered=${answered}/${total} classified=${classified}/${total} titled=${titled}/${total}${ragInfo}${errors ? ` errors=${errors}` : ""}`,
    )
    console.log(`  categories: ${[...new Set(categorySets)].join(" | ")}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
