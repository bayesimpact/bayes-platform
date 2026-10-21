import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { evaluationConversationDatasetFactory } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.factory"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { buildMockTestCasesService } from "@/stories/test-cases/mock-service"
import { agentMessageFeedbackFactory } from "@/studio/features/agent-message-feedback/agent-message-feedback.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  fillForm?: boolean
  /** Datasets a reported answer can be saved into as a test case. */
  withDatasets?: boolean
  withFeedbacks?: boolean
}

const meta = {
  title: "routes/studio/project/agent/feedback",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    fillForm: { control: "boolean" },
    withDatasets: { control: "boolean" },
    withFeedbacks: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    fillForm: false,
    withDatasets: true,
    withFeedbacks: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.feedback.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ fillForm, withDatasets, withFeedbacks, ...args }) => {
      const { baseSeeds, user, project, agents } = buildStudioData(args)
      const [firstAgent, ...restAgents] = agents
      const currentAgent = agentFactory
        .transient({ project })
        .build({ ...firstAgent, type: "conversation" })
      const currentAgentSettings = (
        fillForm ? agentSettingsFactory.fillForm() : agentSettingsFactory
      )
        .transient({ agent: currentAgent })
        .build({ revision: currentAgent.currentRevision?.number ?? 1 })

      // The viewer's own reports: their conversations can be saved as test cases.
      const feedbacks = withFeedbacks
        ? agentMessageFeedbackFactory
            .transient({ agent: currentAgent, project })
            .buildList(3, { userId: user.id })
        : []

      const datasets = withDatasets
        ? evaluationConversationDatasetFactory.transient({ project }).buildList(2)
        : []

      return {
        services: { testCases: buildMockTestCasesService() },
        state: mergeSeeds(
          baseSeeds,
          seed.eval.conversationDatasets(datasets),
          seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
          seed.conversationAgentSessions({ [currentAgent.id]: [] }),
          seed.studio.agentHistory({
            agentId: currentAgent.id,
            versions: [currentAgentSettings],
          }),
          seed.studio.agentMessageFeedbacks({ [currentAgent.id]: feedbacks }),
        ),
      }
    }),
  ],
}

export const WithData: Story = {
  args: {
    organizationMembershipRole: "owner",
    projectMembershipRole: "owner",
    agentMembershipRole: "owner",
    featureFlags: [],
    withAgents: true,
    fillForm: false,
    withDatasets: true,
    withFeedbacks: true,
  },
  decorators: Default.decorators,
}

export const FillFormAgentWithData: Story = {
  args: {
    ...WithData.args,
    fillForm: true,
  },
  decorators: Default.decorators,
}
