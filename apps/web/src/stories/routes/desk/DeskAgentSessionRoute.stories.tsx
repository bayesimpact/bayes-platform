import { faker } from "@faker-js/faker"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import {
  agentSessionMessageFactory,
  conversationAgentSessionFactory,
  formAgentSessionFactory,
} from "@/common/features/agents/agent-sessions/agent-session.factory"
import type { Agent } from "@/common/features/agents/agents.models"
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

type AgentType = Extract<Agent["type"], "conversation" | "form">

type StoryArgs = StudioStoryArgs & {
  agentType: AgentType
  withMessages?: boolean
}

const meta = {
  title: "routes/desk/agent/session",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    agentType: {
      control: "select",
      options: ["conversation", "form"] satisfies AgentType[],
    },
    withMessages: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    agentType: "conversation",
    withMessages: true,
  },
  render: render({ routes: deskRoutes, path: DeskRoutes.agentSession.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ agentType, withMessages, ...args }) => {
      const { baseSeeds, project, agents } = buildStudioData(args)
      const [firstAgent, ...restAgents] = agents

      const outputJsonSchema = {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
          company: { type: "string" },
          role: { type: "string" },
          country: { type: "string" },
          city: { type: "string" },
          industry: { type: "string" },
          teamSize: { type: "string" },
        },
      }
      const formSessionResult = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
        company: faker.company.name(),
        country: faker.location.country(),
        industry: faker.commerce.department(),
        teamSize: faker.string.numeric({ length: { min: 1, max: 2 } }),
      }

      const currentAgent = agentFactory
        .transient({ project })
        .build({ ...firstAgent, type: agentType, outputJsonSchema })

      const conversationSession =
        agentType === "conversation"
          ? conversationAgentSessionFactory.transient({ agent: currentAgent }).build()
          : null

      const formSession =
        agentType === "form"
          ? formAgentSessionFactory
              .transient({ agent: currentAgent })
              .build({ result: formSessionResult })
          : null
      const currentSessionId = (conversationSession ?? formSession)?.id ?? null

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
          seed.conversationAgentSessions({
            [currentAgent.id]: conversationSession ? [conversationSession] : [],
          }),
          seed.formAgentSessions({
            [currentAgent.id]: formSession ? [formSession] : [],
          }),
          seed.currentAgentSessionId(currentSessionId),
          seed.agentSessionMessages(messages),
        ),
      }
    }),
  ],
}

export const FormSession: Story = {
  args: { agentType: "form" },
  decorators: Default.decorators,
}
