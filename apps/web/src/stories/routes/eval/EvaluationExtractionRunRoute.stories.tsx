import type { Meta, StoryObj } from "@storybook/react-vite"
import { DEFAULT_PAGE_SIZE } from "@/common/components/shared/RecordTableParts"
import { agentFactory } from "@/common/features/agents/agent.factory"
import {
  evaluationExtractionDatasetFactory,
  evaluationExtractionDatasetSchemaColumnFactory,
} from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.factory"
import type { EvaluationExtractionDatasetSchemaColumn } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.models"
import {
  evaluationExtractionRunFactory,
  evaluationExtractionRunRecordFactory,
  evaluationExtractionRunRecordFieldResultFactory,
} from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.factory"
import type {
  EvaluationExtractionRun,
  EvaluationExtractionRunRecord,
  EvaluationExtractionRunStatus,
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
import { buildMockExtractionDatasetsService, buildMockExtractionRunsService } from "./helpers"

type StoryArgs = StudioStoryArgs & {
  runStatus: EvaluationExtractionRunStatus
  withRecords?: boolean
  /** Number of scored fields of the run. Without it, the dataset factory's default columns. */
  scoredFieldCount?: number
}

const RUN_STATUSES: EvaluationExtractionRunStatus[] = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]

const RECORD_TOTAL = 3

function buildSummary(runStatus: EvaluationExtractionRunStatus) {
  if (runStatus === "pending" || runStatus === "running") {
    return { total: RECORD_TOTAL, perfectMatches: 1, mismatches: 0, errors: 0, running: 2 }
  }
  if (runStatus === "failed") {
    return { total: RECORD_TOTAL, perfectMatches: 2, mismatches: 0, errors: 1, running: 0 }
  }
  return { total: RECORD_TOTAL, perfectMatches: 2, mismatches: 1, errors: 0, running: 0 }
}

// A dataset with one input column and `scoredFieldCount` target columns, each scored by the run.
function buildSchemaMapping(
  scoredFieldCount: number,
): Record<string, EvaluationExtractionDatasetSchemaColumn> {
  const targetColumns = Array.from({ length: scoredFieldCount }, (_, columnIndex) =>
    evaluationExtractionDatasetSchemaColumnFactory.build({
      finalName: `field_${columnIndex + 1}`,
      originalName: `field_${columnIndex + 1}`,
      index: columnIndex,
      role: "target",
    }),
  )
  const inputColumn = evaluationExtractionDatasetSchemaColumnFactory.build({
    finalName: "source",
    originalName: "source",
    index: scoredFieldCount,
    role: "input",
  })
  return Object.fromEntries([...targetColumns, inputColumn].map((column) => [column.id, column]))
}

// A mismatch record where one scored field in three mismatches, so both statuses show.
function buildMixedComparison(run: EvaluationExtractionRun) {
  return Object.fromEntries(
    run.keyMapping
      .filter((mappingEntry) => mappingEntry.mode === "scored")
      .map((mappingEntry, fieldIndex) => [
        mappingEntry.agentOutputKey,
        evaluationExtractionRunRecordFieldResultFactory.build({
          status: fieldIndex % 3 === 1 ? "mismatch" : "match",
        }),
      ]),
  )
}

function buildRunRecords(
  run: EvaluationExtractionRun,
  runStatus: EvaluationExtractionRunStatus,
  scoredFieldCount?: number,
): EvaluationExtractionRunRecord[] {
  const recordFactory = evaluationExtractionRunRecordFactory.transient({ run })
  if (runStatus === "pending" || runStatus === "running") {
    return [
      recordFactory.build({ status: "match" }),
      recordFactory.build({ status: "running", comparison: null }),
      recordFactory.build({ status: "running", comparison: null }),
    ]
  }
  if (runStatus === "failed") {
    return [
      recordFactory.build({ status: "match" }),
      recordFactory.build({ status: "match" }),
      recordFactory.build({
        status: "error",
        comparison: null,
        errorDetails: "The agent response could not be parsed as JSON.",
      }),
    ]
  }
  if (runStatus === "cancelled") {
    return recordFactory.buildList(RECORD_TOTAL, { status: "cancelled", comparison: null })
  }
  return [
    recordFactory.build({ status: "match" }),
    recordFactory.build({
      status: "mismatch",
      // An explicit `undefined` would replace the factory's default comparison.
      ...(scoredFieldCount ? { comparison: buildMixedComparison(run) } : {}),
    }),
    recordFactory.build({ status: "match" }),
  ]
}

const decorator = buildDecorator<StoryArgs>(
  ({ runStatus, withRecords, scoredFieldCount, ...args }) => {
    const { baseSeeds, project, agents } = buildStudioData(args)
    const dataset = evaluationExtractionDatasetFactory.transient({ project }).build({
      recordCount: RECORD_TOTAL,
      ...(scoredFieldCount ? { schemaMapping: buildSchemaMapping(scoredFieldCount) } : {}),
    })
    const agent = agents[0] ?? agentFactory.transient({ project }).build()
    const run = evaluationExtractionRunFactory
      .transient({ dataset, agent })
      .build({ status: runStatus, summary: buildSummary(runStatus) })
    const records = withRecords ? buildRunRecords(run, runStatus, scoredFieldCount) : []
    // The records table loads its first page itself, from the mocked service.
    const paginatedRecords = {
      records,
      total: records.length,
      page: 0,
      limit: DEFAULT_PAGE_SIZE,
    }
    return {
      state: mergeSeeds(
        baseSeeds,
        seed.eval.extractionDatasets([dataset], { currentId: dataset.id }),
        seed.eval.extractionRuns([run], { currentId: run.id }),
      ),
      services: {
        evaluationExtractionDatasets: buildMockExtractionDatasetsService({ datasets: [dataset] }),
        evaluationExtractionRuns: buildMockExtractionRunsService({
          runs: [run],
          records: paginatedRecords,
        }),
      },
    }
  },
)

const meta = {
  title: "routes/eval/extraction/run",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    runStatus: { control: "select", options: RUN_STATUSES },
    withRecords: { control: "boolean" },
    scoredFieldCount: { control: { type: "number", min: 1, max: 20 } },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    runStatus: "completed",
    withRecords: true,
  },
  render: render({ routes: evalRoutes, path: EvalRoutes.evaluationRun.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Running: Story = {
  args: { runStatus: "running" },
  decorators: [decorator],
}

export const Completed: Story = {
  args: { runStatus: "completed" },
  decorators: [decorator],
}

export const Failed: Story = {
  args: { runStatus: "failed" },
  decorators: [decorator],
}

export const ManyScoredFields: Story = {
  args: { runStatus: "completed", scoredFieldCount: 8 },
  decorators: [decorator],
}
