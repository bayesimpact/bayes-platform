import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  backofficeAgentConversationReviewerFactory,
  backofficeAgentDetailFactory,
} from "@/backoffice/features/backoffice/backoffice.factory"
import { backofficeRoutes } from "@/backoffice/routes/BackofficeRoutes"
import { BackofficeAgentRoutes } from "@/backoffice/routes/helpers"
import { buildDecorator, render } from "@/stories/decorators"
import {
  type BackofficeStoryArgs,
  backofficeStoryArgs,
  backofficeStoryArgTypes,
  buildBackofficeData,
  buildMockBackofficeService,
} from "@/stories/routes/backoffice/helpers"
import { mergeSeeds, seed } from "@/stories/seed"

const BACKOFFICE_STORY_AGENT_ID = "4f7c2a9e-1b3d-4e5f-8a6b-7c8d9e0f1a2b"

type StoryArgs = BackofficeStoryArgs & {
  withConversationReviewers?: boolean
}

const decorator = buildDecorator<StoryArgs>(({ withConversationReviewers, ...args }) => {
  const { baseSeeds, organizations, users, termsDocuments, appManifests } =
    buildBackofficeData(args)
  const agentDetail = backofficeAgentDetailFactory.build({
    id: BACKOFFICE_STORY_AGENT_ID,
    conversationReviewers: withConversationReviewers
      ? backofficeAgentConversationReviewerFactory.buildList(2)
      : [],
  })
  return {
    state: mergeSeeds(baseSeeds, seed.backoffice.agentDetail(agentDetail)),
    services: {
      backoffice: buildMockBackofficeService({
        organizations,
        users,
        termsDocuments,
        appManifests,
        agentDetails: { [agentDetail.id]: agentDetail },
      }),
    },
  }
})

const meta = {
  title: "routes/backoffice/agents/detail",
  parameters: { layout: "fullscreen" },
  argTypes: { ...backofficeStoryArgTypes, withConversationReviewers: { control: "boolean" } },
  args: { ...backofficeStoryArgs, withConversationReviewers: false },
  decorators: [decorator],
  render: render({
    path: BackofficeAgentRoutes.agent.build({ agentId: BACKOFFICE_STORY_AGENT_ID }),
    routes: backofficeRoutes,
  }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithConversationReviewers: Story = {
  args: { withConversationReviewers: true },
}
