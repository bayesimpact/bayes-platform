import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import {
  agentSessionMessageFactory,
  conversationAgentSessionFactory,
} from "@/common/features/agents/agent-sessions/agent-session.factory"
import { deskRoutes } from "@/desk/routes/DeskRoutes"
import { DeskRoutes } from "@/desk/routes/helpers"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"

type StoryArgs = StudioStoryArgs & {
  fillForm?: boolean
  withMessages?: boolean
}

const meta = {
  title: "routes/desk/agent/session",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    fillForm: { control: "boolean" },
    withMessages: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    fillForm: false,
    withMessages: true,
  },
  render: render({ routes: deskRoutes, path: DeskRoutes.agentSession.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ fillForm, withMessages, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const [firstAgent, ...restAgents] = agents

      const currentAgent = (fillForm ? agentFactory.fillForm() : agentFactory)
        .transient({ project })
        .build({ ...firstAgent, type: "conversation", fillFormEnabled: !!fillForm })

      const sessionFactory = conversationAgentSessionFactory.transient({ agent: currentAgent })
      // fillForm-enabled agents accumulate a form result on the session, shown in the right panel.
      const session = (fillForm ? sessionFactory.withResult() : sessionFactory).build()

      const messages = withMessages
        ? [
            agentSessionMessageFactory.build({ role: "user" }),
            agentSessionMessageFactory.build({ role: "assistant" }),
            agentSessionMessageFactory.build({ role: "user" }),
            agentSessionMessageFactory.build({ role: "assistant" }),
          ]
        : []

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
          seed.conversationAgentSessions({ [currentAgent.id]: [session] }),
          seed.currentAgentSessionId(session.id),
          seed.agentSessionMessages(messages),
        ),
      }
    }),
  ],
}

export const FillFormSession: Story = {
  args: { fillForm: true },
  decorators: Default.decorators,
}
