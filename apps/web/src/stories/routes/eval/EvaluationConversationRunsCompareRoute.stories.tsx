import { AgentModel } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { DEFAULT_PAGE_SIZE } from "@/common/components/shared/RecordTableParts"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { evaluationConversationDatasetFactory } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.factory"
import {
  evaluationConversationRunFactory,
  evaluationConversationRunRecordFactory,
} from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.factory"
import type { EvaluationConversationRunRecord } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.models"
import { evalRoutes } from "@/eval/routes/EvalRoutes"
import { EvalRoutes } from "@/eval/routes/helpers"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import {
  buildMockAgentsService,
  buildMockConversationDatasetsService,
  buildMockConversationRunsService,
} from "./helpers"

type StoryArgs = StudioStoryArgs

const RUN_IDS = ["run-a", "run-b", "run-c"] as const

// Shared source records: every run grades the same dataset records (same ids), so the
// compare page aligns scores row by row and highlights the best-scoring run per record.
const RECORD_SPECS = [
  { datasetRecordId: "rec-1", input: "How do I reset my password?" },
  { datasetRecordId: "rec-2", input: "What are your opening hours?" },
  { datasetRecordId: "rec-3", input: "Can I get a refund?" },
]

const SCORES_BY_RUN = {
  "run-a": [3, 4, 4],
  "run-b": [4, 4, 5],
  "run-c": [5, 3, 5],
}

const RUN_CONFIG = {
  "run-a": {
    revision: 17,
    model: AgentModel.Gemini25Flash,
    judgeModel: AgentModel.Gemini25Flash,
    averageScore: 3.7,
  },
  "run-b": {
    revision: 17,
    model: AgentModel.Gemini25Flash,
    judgeModel: AgentModel.Gemini31FlashLite,
    averageScore: 4.3,
  },
  "run-c": {
    revision: 16,
    model: AgentModel.Gemini25Pro,
    judgeModel: AgentModel.Gemini25Pro,
    averageScore: 4.3,
  },
}

const decorator = buildDecorator<StoryArgs>((args) => {
  const { baseSeeds, project, agents } = buildStudioData({ ...args, withAgents: true })
  const dataset = evaluationConversationDatasetFactory
    .transient({ project })
    .build({ recordCount: RECORD_SPECS.length })
  const agent = agents[0] ?? agentFactory.transient({ project }).build()

  const runs = RUN_IDS.map((runId) => {
    const config = RUN_CONFIG[runId]
    return evaluationConversationRunFactory.transient({ dataset, agent }).build({
      id: runId,
      agentSettings: { revision: config.revision, model: config.model },
      judgeModel: config.judgeModel,
      status: "completed",
      summary: {
        total: RECORD_SPECS.length,
        graded: RECORD_SPECS.length,
        errors: 0,
        running: 0,
        averageScore: config.averageScore,
      },
    })
  })

  const recordsByRunId: Record<string, EvaluationConversationRunRecord[]> = Object.fromEntries(
    runs.map((run) => [
      run.id,
      RECORD_SPECS.map((spec, index) =>
        evaluationConversationRunRecordFactory.transient({ run }).build({
          evaluationConversationDatasetRecordId: spec.datasetRecordId,
          input: spec.input,
          expectedOutput: `Expected answer for ${spec.datasetRecordId}`,
          score: SCORES_BY_RUN[run.id as keyof typeof SCORES_BY_RUN]?.[index] ?? 0,
          status: "graded",
        }),
      ),
    ]),
  )

  const paginatedByRunId = Object.fromEntries(
    Object.entries(recordsByRunId).map(([runId, records]) => [
      runId,
      { records, total: records.length, page: 0, limit: DEFAULT_PAGE_SIZE },
    ]),
  )

  return {
    state: mergeSeeds(
      baseSeeds,
      seed.eval.conversationDatasets([dataset], { currentId: dataset.id }),
      seed.eval.conversationRuns(runs),
      seed.eval.conversationRunsComparison(recordsByRunId),
    ),
    services: {
      agents: buildMockAgentsService({ agents }),
      evaluationConversationDatasets: buildMockConversationDatasetsService({
        datasets: [dataset],
      }),
      evaluationConversationRuns: buildMockConversationRunsService({
        runs,
        recordsByRunId: paginatedByRunId,
      }),
    },
  }
})

const meta = {
  title: "routes/eval/conversation/compare",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
  },
  args: {
    ...studioStoryArgs,
    featureFlags: [...studioStoryArgs.featureFlags, "evaluation"],
    withAgents: true,
  },
  render: render({
    routes: evalRoutes,
    path: `${EvalRoutes.conversationDatasetCompare.path}?runs=${RUN_IDS.join(",")}`,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const CompareRuns: Story = {
  decorators: [decorator],
}
