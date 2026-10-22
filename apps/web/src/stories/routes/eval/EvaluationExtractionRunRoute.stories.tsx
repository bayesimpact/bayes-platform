import type { Meta, StoryObj } from "@storybook/react-vite"
import { DEFAULT_PAGE_SIZE } from "@/common/components/shared/RecordTableParts"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { evaluationExtractionDatasetFactory } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.factory"
import {
  evaluationExtractionRunFactory,
  evaluationExtractionRunRecordFactory,
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

function buildRunRecords(
  run: EvaluationExtractionRun,
  runStatus: EvaluationExtractionRunStatus,
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
    recordFactory.build({ status: "mismatch" }),
    recordFactory.build({ status: "match" }),
  ]
}

const decorator = buildDecorator<StoryArgs>(({ runStatus, withRecords, ...args }) => {
  const { baseSeeds, project, agents } = buildStudioData(args)
  const dataset = evaluationExtractionDatasetFactory
    .transient({ project })
    .build({ recordCount: RECORD_TOTAL })
  const agent = agents[0] ?? agentFactory.transient({ project }).build()
  const run = evaluationExtractionRunFactory
    .transient({ dataset, agent })
    .build({ status: runStatus, summary: buildSummary(runStatus) })
  const records = withRecords ? buildRunRecords(run, runStatus) : []
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
})

const meta = {
  title: "routes/eval/extraction/run",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    runStatus: { control: "select", options: RUN_STATUSES },
    withRecords: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    featureFlags: [...studioStoryArgs.featureFlags, "evaluation"],
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
