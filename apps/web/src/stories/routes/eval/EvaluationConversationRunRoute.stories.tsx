import type { Meta, StoryObj } from "@storybook/react-vite"
import { DEFAULT_PAGE_SIZE } from "@/common/components/shared/RecordTableParts"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { evaluationConversationDatasetFactory } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.factory"
import {
  evaluationConversationRunFactory,
  evaluationConversationRunRecordFactory,
  evaluationConversationRunSummaryFactory,
} from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.factory"
import type {
  EvaluationConversationRun,
  EvaluationConversationRunRecord,
  EvaluationConversationRunStatus,
} from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.models"
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
import { buildMockConversationDatasetsService, buildMockConversationRunsService } from "./helpers"

type StoryArgs = StudioStoryArgs & {
  runStatus: EvaluationConversationRunStatus
  withRecords?: boolean
}

const RUN_STATUSES: EvaluationConversationRunStatus[] = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]

const RECORD_TOTAL = 3

function buildSummary(runStatus: EvaluationConversationRunStatus) {
  if (runStatus === "pending" || runStatus === "running") {
    return evaluationConversationRunSummaryFactory.build({
      total: RECORD_TOTAL,
      graded: 1,
      running: 2,
      errors: 0,
    })
  }
  if (runStatus === "failed") {
    return evaluationConversationRunSummaryFactory.build({
      total: RECORD_TOTAL,
      graded: 2,
      running: 0,
      errors: 1,
    })
  }
  return evaluationConversationRunSummaryFactory.build({
    total: RECORD_TOTAL,
    graded: RECORD_TOTAL,
    running: 0,
    errors: 0,
  })
}

function buildRunRecords(
  run: EvaluationConversationRun,
  runStatus: EvaluationConversationRunStatus,
): EvaluationConversationRunRecord[] {
  const recordFactory = evaluationConversationRunRecordFactory.transient({ run })
  if (runStatus === "pending" || runStatus === "running") {
    return [
      recordFactory.build({ status: "graded" }),
      recordFactory.build({ status: "running", output: null, score: null }),
      recordFactory.build({ status: "running", output: null, score: null }),
    ]
  }
  if (runStatus === "failed") {
    return [
      recordFactory.build({ status: "graded" }),
      recordFactory.build({ status: "graded" }),
      recordFactory.build({
        status: "error",
        output: null,
        score: null,
        errorDetails: "The grader response could not be parsed into a score.",
      }),
    ]
  }
  if (runStatus === "cancelled") {
    return recordFactory.buildList(RECORD_TOTAL, {
      status: "cancelled",
      output: null,
      score: null,
    })
  }
  return recordFactory.buildList(RECORD_TOTAL, { status: "graded" })
}

const decorator = buildDecorator<StoryArgs>(({ runStatus, withRecords, ...args }) => {
  const { baseSeeds, project, agents } = buildStudioData(args)
  const dataset = evaluationConversationDatasetFactory
    .transient({ project })
    .build({ recordCount: RECORD_TOTAL })
  const agent = agents[0] ?? agentFactory.transient({ project }).build()
  // Pin an explicit agent-settings revision so the metadata dialog shows the version row.
  const run = evaluationConversationRunFactory.transient({ dataset, agent }).build({
    status: runStatus,
    summary: buildSummary(runStatus),
    agentSettings: { revision: 2 },
  })
  const records = withRecords ? buildRunRecords(run, runStatus) : []
  const paginatedRecords = {
    records,
    total: records.length,
    page: 0,
    limit: DEFAULT_PAGE_SIZE,
  }
  return {
    state: mergeSeeds(
      baseSeeds,
      seed.eval.conversationDatasets([dataset], { currentId: dataset.id }),
      seed.eval.conversationRuns([run], { currentId: run.id }),
      seed.eval.conversationRunRecords(paginatedRecords),
    ),
    services: {
      evaluationConversationDatasets: buildMockConversationDatasetsService({
        datasets: [dataset],
      }),
      evaluationConversationRuns: buildMockConversationRunsService({
        runs: [run],
        records: paginatedRecords,
      }),
    },
  }
})

const meta = {
  title: "routes/eval/conversation/run",
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
  render: render({ routes: evalRoutes, path: EvalRoutes.conversationRun.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Running: Story = {
  args: {
    runStatus: "running",
  },
  decorators: [decorator],
}

export const Completed: Story = {
  args: {
    runStatus: "completed",
  },
  decorators: [decorator],
}

export const Failed: Story = {
  args: {
    runStatus: "failed",
  },
  decorators: [decorator],
}
