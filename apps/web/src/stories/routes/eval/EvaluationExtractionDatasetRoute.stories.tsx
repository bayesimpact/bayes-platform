import type { Meta, StoryObj } from "@storybook/react-vite"
import { DEFAULT_PAGE_SIZE } from "@/common/components/shared/RecordTableParts"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import {
  evaluationExtractionDatasetFactory,
  evaluationExtractionDatasetRecordRowFactory,
} from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.factory"
import { evaluationExtractionRunFactory } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.factory"
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

type StoryArgs = StudioStoryArgs & {
  withRecords?: boolean
  withRuns?: boolean
}

// Revision 1 is the agent factory's published revision, so the dialog finds its current settings.
const RUN_REVISIONS = [1, 2, 3]

const decorator = buildDecorator<StoryArgs>(({ withRecords, withRuns, ...args }) => {
  const { baseSeeds, project, agents } = buildStudioData(args)
  const dataset = evaluationExtractionDatasetFactory
    .transient({ project })
    .build({ recordCount: withRecords ? 3 : 0 })
  const records = withRecords
    ? evaluationExtractionDatasetRecordRowFactory.transient({ dataset }).buildList(3)
    : []
  const paginatedRecords = {
    records,
    total: records.length,
    page: 0,
    limit: DEFAULT_PAGE_SIZE,
  }
  const agent = agents[0] ?? agentFactory.transient({ project }).build()
  const runs = withRuns
    ? RUN_REVISIONS.map((agentRevision) =>
        evaluationExtractionRunFactory.transient({ dataset, agent }).build({ agentRevision }),
      )
    : []
  // Each run's agent info button waits for the agent's settings history, including the
  // revision the run pinned.
  const agentVersions = RUN_REVISIONS.map((revision) =>
    agentSettingsFactory.transient({ agent }).build({ revision }),
  )
  return {
    state: mergeSeeds(
      baseSeeds,
      seed.eval.extractionDatasets([dataset], { currentId: dataset.id }),
      seed.eval.extractionDatasetRecords(paginatedRecords),
      seed.eval.extractionRuns(runs),
      seed.studio.agentHistory({ agentId: agent.id, versions: agentVersions }),
    ),
    services: {
      agents: buildMockAgentsService({ agents }),
      evaluationExtractionDatasets: buildMockExtractionDatasetsService({
        datasets: [dataset],
        records: paginatedRecords,
      }),
      evaluationExtractionRuns: buildMockExtractionRunsService({ runs }),
    },
  }
})

const meta = {
  title: "routes/eval/extraction/dataset",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withRecords: { control: "boolean" },
    withRuns: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    featureFlags: [...studioStoryArgs.featureFlags, "evaluation"],
    withRecords: false,
    withRuns: false,
  },
  render: render({ routes: evalRoutes, path: EvalRoutes.extractionDataset.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  decorators: [decorator],
}

export const WithRunHistory: Story = {
  args: {
    withAgents: true,
    withRecords: true,
    withRuns: true,
  },
  decorators: [decorator],
}
