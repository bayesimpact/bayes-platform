import type { Meta, StoryObj } from "@storybook/react-vite"
import { DEFAULT_PAGE_SIZE } from "@/common/components/shared/RecordTableParts"
import { agentFactory } from "@/common/features/agents/agent.factory"
import {
  evaluationConversationDatasetFactory,
  evaluationConversationDatasetRecordFactory,
} from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.factory"
import { evaluationConversationRunFactory } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.factory"
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
  withRecords?: boolean
  withRuns?: boolean
}

const decorator = buildDecorator<StoryArgs>(({ withRecords, withRuns, ...args }) => {
  const { baseSeeds, project, agents } = buildStudioData(args)
  const dataset = evaluationConversationDatasetFactory
    .transient({ project })
    .build({ recordCount: withRecords ? 3 : 0 })
  const records = withRecords
    ? evaluationConversationDatasetRecordFactory.transient({ dataset }).buildList(3)
    : []
  const paginatedRecords = {
    records,
    total: records.length,
    page: 0,
    limit: DEFAULT_PAGE_SIZE,
  }
  const agent = agents[0] ?? agentFactory.transient({ project }).build()
  const runs = withRuns
    ? evaluationConversationRunFactory.transient({ dataset, agent }).buildList(3)
    : []
  return {
    state: mergeSeeds(
      baseSeeds,
      seed.eval.conversationDatasets([dataset], { currentId: dataset.id }),
      seed.eval.conversationDatasetRecords(paginatedRecords),
      seed.eval.conversationRuns(runs),
    ),
    services: {
      evaluationConversationDatasets: buildMockConversationDatasetsService({
        datasets: [dataset],
        records: paginatedRecords,
      }),
      evaluationConversationRuns: buildMockConversationRunsService({ runs }),
    },
  }
})

const meta = {
  title: "routes/eval/conversation/dataset",
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
  render: render({ routes: evalRoutes, path: EvalRoutes.conversationDataset.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  decorators: [decorator],
}

export const WithRecords: Story = {
  args: {
    withRecords: true,
  },
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
