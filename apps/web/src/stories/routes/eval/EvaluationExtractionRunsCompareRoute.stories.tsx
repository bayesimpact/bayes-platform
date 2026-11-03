import type { Meta, StoryObj } from "@storybook/react-vite"
import { DEFAULT_PAGE_SIZE } from "@/common/components/shared/RecordTableParts"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { evaluationExtractionDatasetFactory } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.factory"
import {
  evaluationExtractionRunFactory,
  evaluationExtractionRunRecordFactory,
} from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.factory"
import type {
  EvaluationExtractionRunRecord,
  EvaluationExtractionRunRecordStatus,
} from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.models"
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
  buildMockExtractionDatasetsService,
  buildMockExtractionRunsService,
} from "./helpers"

type StoryArgs = StudioStoryArgs

const RUN_IDS = ["run-a", "run-b", "run-c"] as const

// Shared source records: every run extracts the same dataset records (same ids), so the
// compare page aligns results row by row.
const RECORD_SPECS = [
  { datasetRecordId: "rec-1", title: "Standard subscription", summary: "Monthly plan" },
  { datasetRecordId: "rec-2", title: "Premium subscription", summary: "Yearly plan" },
  { datasetRecordId: "rec-3", title: "Support request", summary: "Refund question" },
]

const STATUSES_BY_RUN: Record<string, EvaluationExtractionRunRecordStatus[]> = {
  "run-a": ["match", "mismatch", "mismatch"],
  "run-b": ["match", "match", "mismatch"],
  "run-c": ["match", "match", "match"],
}

const RUN_CONFIG = {
  "run-a": { revision: 3, perfectMatches: 1 },
  "run-b": { revision: 4, perfectMatches: 2 },
  "run-c": { revision: 5, perfectMatches: 3 },
}

const decorator = buildDecorator<StoryArgs>((args) => {
  const { baseSeeds, project, agents } = buildStudioData({ ...args, withAgents: true })
  const dataset = evaluationExtractionDatasetFactory
    .transient({ project })
    .build({ recordCount: RECORD_SPECS.length })
  const agent = agents[0] ?? agentFactory.transient({ project }).build()

  const runs = RUN_IDS.map((runId) => {
    const config = RUN_CONFIG[runId]
    return evaluationExtractionRunFactory.transient({ dataset, agent }).build({
      id: runId,
      agentRevision: config.revision,
      status: "completed",
      summary: {
        total: RECORD_SPECS.length,
        perfectMatches: config.perfectMatches,
        mismatches: RECORD_SPECS.length - config.perfectMatches,
        errors: 0,
        running: 0,
      },
    })
  })

  const recordsByRunId: Record<string, EvaluationExtractionRunRecord[]> = Object.fromEntries(
    runs.map((run) => [
      run.id,
      RECORD_SPECS.map((spec, index) =>
        evaluationExtractionRunRecordFactory.transient({ run }).build({
          evaluationExtractionDatasetRecordId: spec.datasetRecordId,
          status: STATUSES_BY_RUN[run.id]?.[index] ?? "match",
          datasetRecordData: { title: spec.title, summary: spec.summary },
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
      seed.eval.extractionDatasets([dataset], { currentId: dataset.id }),
      seed.eval.extractionRuns(runs),
      seed.eval.extractionRunsComparison(recordsByRunId),
    ),
    services: {
      agents: buildMockAgentsService({ agents }),
      evaluationExtractionDatasets: buildMockExtractionDatasetsService({
        datasets: [dataset],
      }),
      evaluationExtractionRuns: buildMockExtractionRunsService({
        runs,
        recordsByRunId: paginatedByRunId,
      }),
    },
  }
})

const meta = {
  title: "routes/eval/extraction/compare",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
  },
  render: render({
    routes: evalRoutes,
    path: `${EvalRoutes.extractionDatasetCompare.path}?runs=${RUN_IDS.join(",")}`,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const CompareRuns: Story = {
  decorators: [decorator],
}
