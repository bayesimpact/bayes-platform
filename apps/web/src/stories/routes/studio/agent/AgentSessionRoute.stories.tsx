import { faker } from "@faker-js/faker"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import {
  agentSessionMessageFactory,
  conversationAgentSessionFactory,
  conversationSubSessionFactory,
} from "@/common/features/agents/agent-sessions/agent-session.factory"
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
  fillForm?: boolean
  withMessages?: boolean
  withSubAgentForms?: boolean
}

const meta = {
  title: "routes/studio/project/agent/session",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    fillForm: { control: "boolean" },
    withMessages: { control: "boolean" },
    withSubAgentForms: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    fillForm: false,
    withMessages: true,
    withSubAgentForms: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agentSession.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ fillForm, withMessages, withSubAgentForms, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const [firstAgent, ...restAgents] = agents

      const currentAgent = (fillForm ? agentFactory.fillForm() : agentFactory)
        .transient({ project })
        .build({ ...firstAgent, type: "conversation", fillFormEnabled: !!fillForm })

      const sessionFactory = conversationAgentSessionFactory.transient({ agent: currentAgent })
      // fillForm-enabled agents accumulate a form result on the session, shown in the right panel.
      const session = (fillForm ? sessionFactory.withResult() : sessionFactory).build()

      // fillForm-enabled sub-agents the parent conversation delegated to during this session.
      const subSessions = withSubAgentForms
        ? [
            conversationSubSessionFactory.build({
              toolName: "collect_contact",
              agentName: "Contact Assistant",
            }),
            conversationSubSessionFactory.build({
              toolName: "collect_details",
              agentName: "Details Assistant",
            }),
          ]
        : []

      const assistantMessage = agentSessionMessageFactory.build({
        role: "assistant",
        toolCalls: withSubAgentForms
          ? subSessions.map((subSession) => ({
              id: faker.string.uuid(),
              name: subSession.toolName,
              arguments: {},
            }))
          : undefined,
      })

      const messages = withMessages
        ? [
            agentSessionMessageFactory.build({ role: "user" }),
            assistantMessage,
            agentSessionMessageFactory.build({ role: "user" }),
            agentSessionMessageFactory.build({ role: "assistant" }),
          ]
        : []

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
          seed.conversationAgentSessions({ [currentAgent.id]: [session] }),
          subSessions.length > 0 ? seed.conversationSubSessions({ [session.id]: subSessions }) : {},
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

export const WithSubAgentForms: Story = {
  args: { withMessages: true, withSubAgentForms: true },
  decorators: Default.decorators,
}
