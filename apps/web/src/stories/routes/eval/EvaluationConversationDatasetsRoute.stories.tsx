import type { Meta, StoryObj } from "@storybook/react-vite"
import { evaluationConversationDatasetFactory } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.factory"
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
  withDatasets?: boolean
}

const decorator = buildDecorator<StoryArgs>(({ withDatasets, ...args }) => {
  const { baseSeeds, project } = buildStudioData(args)
  const datasets = withDatasets
    ? evaluationConversationDatasetFactory.transient({ project }).buildList(3)
    : []
  return {
    state: mergeSeeds(
      baseSeeds,
      seed.eval.conversationDatasets(datasets),
      seed.eval.conversationRuns([]),
    ),
    services: {
      evaluationConversationDatasets: buildMockConversationDatasetsService({ datasets }),
      evaluationConversationRuns: buildMockConversationRunsService(),
    },
  }
})

const meta = {
  title: "routes/eval/conversation/datasets",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withDatasets: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    featureFlags: [...studioStoryArgs.featureFlags, "evaluation"],
    withDatasets: false,
  },
  render: render({ routes: evalRoutes, path: EvalRoutes.conversation.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  decorators: [decorator],
}

export const WithDatasets: Story = {
  args: {
    withDatasets: true,
  },
  decorators: [decorator],
}
