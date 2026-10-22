import type { Meta, StoryObj } from "@storybook/react-vite"
import { DEFAULT_PAGE_SIZE } from "@/common/components/shared/RecordTableParts"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import {
  agentCsvExtractionRunFactory,
  agentCsvExtractionRunRecordFactory,
} from "@/common/features/agents/csv-extraction-runs/agent-csv-extraction-runs.factory"
import type {
  AgentCsvExtractionRun,
  AgentCsvExtractionRunRecord,
  AgentCsvExtractionRunStatus,
  PaginatedAgentCsvExtractionRunRecords,
} from "@/common/features/agents/csv-extraction-runs/agent-csv-extraction-runs.models"
import type { IAgentCsvExtractionRunsSpi } from "@/common/features/agents/csv-extraction-runs/agent-csv-extraction-runs.spi"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  runStatus: AgentCsvExtractionRunStatus
  withRecords?: boolean
}

const RUN_STATUSES: AgentCsvExtractionRunStatus[] = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]

const RECORD_TOTAL = 3

function buildSummary(runStatus: AgentCsvExtractionRunStatus) {
  if (runStatus === "pending" || runStatus === "running") {
    return { total: RECORD_TOTAL, processed: 1, errors: 0, running: 2 }
  }
  if (runStatus === "failed") {
    return { total: RECORD_TOTAL, processed: RECORD_TOTAL, errors: 1, running: 0 }
  }
  return { total: RECORD_TOTAL, processed: RECORD_TOTAL, errors: 0, running: 0 }
}

function buildRunRecords(
  run: AgentCsvExtractionRun,
  runStatus: AgentCsvExtractionRunStatus,
): AgentCsvExtractionRunRecord[] {
  const recordFactory = agentCsvExtractionRunRecordFactory.transient({ run })
  if (runStatus === "pending" || runStatus === "running") {
    return [
      recordFactory.build({ rowIndex: 0 }),
      recordFactory.build({ rowIndex: 1, status: "running", agentRawOutput: null }),
      recordFactory.build({ rowIndex: 2, status: "running", agentRawOutput: null }),
    ]
  }
  if (runStatus === "failed") {
    return [
      recordFactory.build({ rowIndex: 0 }),
      recordFactory.build({ rowIndex: 1 }),
      recordFactory.build({
        rowIndex: 2,
        status: "error",
        agentRawOutput: null,
        errorDetails: "The agent response could not be parsed as JSON.",
      }),
    ]
  }
  return [0, 1, 2].map((rowIndex) => recordFactory.build({ rowIndex }))
}

function buildMockCsvRunsService(
  run: AgentCsvExtractionRun,
  records: PaginatedAgentCsvExtractionRunRecords,
): IAgentCsvExtractionRunsSpi {
  return {
    async createOne() {
      return run
    },
    async executeOne() {
      return run
    },
    async retryOne() {
      return run
    },
    async cancelOne() {
      return { ...run, status: "cancelled" }
    },
    async getOne() {
      return run
    },
    async getAll() {
      return [run]
    },
    async getFileColumns() {
      return []
    },
    async getRecords() {
      return records
    },
    async streamRunStatus() {},
    async getExportTemporaryUrl() {
      return { url: "https://example.com/export.csv" }
    },
    async deleteOne() {},
  }
}

const decorator = buildDecorator<StoryArgs>(({ runStatus, withRecords, ...args }) => {
  const { baseSeeds, project, agents } = buildStudioData(args)
  const [firstAgent, ...restAgents] = agents
  const agent = agentFactory.transient({ project }).build({ ...firstAgent, type: "extraction" })
  const run = agentCsvExtractionRunFactory
    .transient({ agent })
    .build({ status: runStatus, summary: buildSummary(runStatus), agentRevision: 1 })
  const records = withRecords ? buildRunRecords(run, runStatus) : []
  // The records table loads its first page itself, from the mocked service.
  const paginatedRecords = {
    records,
    total: records.length,
    page: 0,
    limit: DEFAULT_PAGE_SIZE,
  }
  const versions = [agentSettingsFactory.transient({ agent }).build({ revision: 1 })]

  return {
    state: mergeSeeds(
      baseSeeds,
      seed.agents([...restAgents, agent], { currentId: agent.id }),
      seed.extractionAgentSessions({ [agent.id]: { csvSessions: [run], others: [] } }),
      // The parent extraction route waits on the agent's documents.
      seed.extractionAgentSessionDocuments([]),
      seed.currentCsvRunId(run.id),
      seed.studio.agentHistory({ agentId: agent.id, versions }),
    ),
    services: {
      agentCsvExtractionRuns: buildMockCsvRunsService(run, paginatedRecords),
    },
  }
})

const meta = {
  title: "routes/studio/project/agent/csvExtractionRun",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    runStatus: { control: "select", options: RUN_STATUSES },
    withRecords: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    runStatus: "completed",
    withRecords: true,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agentExtractionCsvRun.path }),
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
