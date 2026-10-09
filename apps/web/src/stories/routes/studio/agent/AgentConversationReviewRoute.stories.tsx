import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import {
  conversationReviewFactory,
  conversationReviewMessageFactory,
} from "@/studio/features/conversation-review/conversation-review.factory"
import type { ConversationReview } from "@/studio/features/conversation-review/conversation-review.models"
import type { IConversationReviewSpi } from "@/studio/features/conversation-review/conversation-review.spi"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  canReviewConversations?: boolean
  withReview?: boolean
}

function buildMockConversationReviewService(review: ConversationReview): IConversationReviewSpi {
  return {
    async getOne() {
      return review
    },
  }
}

const meta = {
  title: "routes/studio/project/agent/conversation-review",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    canReviewConversations: { control: "boolean" },
    withReview: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    canReviewConversations: true,
    withReview: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agentConversationReview.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ canReviewConversations, withReview, ...args }) => {
      const { baseSeeds, user, project, agents } = buildStudioData(args)
      const [firstAgent, ...restAgents] = agents
      const currentAgent = agentFactory
        .transient({ project })
        .build({ ...firstAgent, type: "conversation" })
      const currentAgentSettings = agentSettingsFactory
        .transient({ agent: currentAgent })
        .build({ revision: currentAgent.currentRevision.number })

      const review = conversationReviewFactory.build({
        agentId: currentAgent.id,
        title: "Question about pricing",
        messages: [
          conversationReviewMessageFactory.build({ role: "user" }),
          conversationReviewMessageFactory.build({
            role: "assistant",
            status: "completed",
            toolNames: ["lookup_knowledge_base"],
          }),
          conversationReviewMessageFactory.build({ role: "user" }),
          conversationReviewMessageFactory.build({ role: "assistant", status: "error" }),
        ],
      })

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.me({
            ...user,
            globalPermissions: canReviewConversations ? ["agent.conversation.review"] : [],
          }),
          seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
          seed.conversationAgentSessions({ [currentAgent.id]: [] }),
          seed.studio.agentHistory({
            agentId: currentAgent.id,
            versions: [currentAgentSettings],
          }),
          withReview ? seed.studio.conversationReview(review) : {},
        ),
        services: {
          conversationReview: buildMockConversationReviewService(review),
        },
      }
    }),
  ],
}

export const WithConversation: Story = {
  args: { withReview: true },
  decorators: Default.decorators,
}

export const WithoutPermission: Story = {
  args: { canReviewConversations: false },
  decorators: Default.decorators,
}
