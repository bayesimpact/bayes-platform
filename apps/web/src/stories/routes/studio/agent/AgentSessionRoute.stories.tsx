import { faker } from "@faker-js/faker"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import {
  agentSessionMessageFactory,
  conversationAgentSessionFactory,
  formAgentSessionFactory,
  formSubSessionFactory,
} from "@/common/features/agents/agent-sessions/agent-session.factory"
import type { Agent } from "@/common/features/agents/agents.models"
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

type AgentType = Extract<Agent["type"], "conversation" | "form">

type StoryArgs = StudioStoryArgs & {
  agentType: AgentType
  withMessages?: boolean
  withSubAgentForms?: boolean
}

const meta = {
  title: "routes/studio/project/agent/session",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    agentType: {
      control: "select",
      options: ["conversation", "form"] satisfies AgentType[],
    },
    withMessages: { control: "boolean" },
    withSubAgentForms: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    agentType: "conversation",
    withMessages: true,
    withSubAgentForms: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agentSession.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ agentType, withMessages, withSubAgentForms, ...args }) => {
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

      // Form sub-agents the parent conversation delegated to during this session.
      const showSubAgentForms = withSubAgentForms && agentType === "conversation"
      const subSessions = showSubAgentForms
        ? [
            formSubSessionFactory
              .transient({
                session: formAgentSessionFactory.build({
                  type: "playground",
                  result: { fullName: faker.person.fullName(), email: faker.internet.email() },
                }),
              })
              .build({
                toolName: "collect_contact",
                agentName: "Contact Form",
                outputJsonSchema: {
                  type: "object",
                  properties: { fullName: { type: "string" }, email: { type: "string" } },
                },
              }),
            formSubSessionFactory
              .transient({
                session: formAgentSessionFactory.build({
                  type: "playground",
                  result: { company: faker.company.name(), industry: faker.commerce.department() },
                }),
              })
              .build({
                toolName: "collect_company",
                agentName: "Company Form",
                outputJsonSchema: {
                  type: "object",
                  properties: { company: { type: "string" }, industry: { type: "string" } },
                },
              }),
          ]
        : []

      const assistantMessage = agentSessionMessageFactory.build({
        role: "assistant",
        toolCalls: showSubAgentForms
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
          seed.conversationAgentSessions({
            [currentAgent.id]: conversationSession ? [conversationSession] : [],
          }),
          seed.formAgentSessions({
            [currentAgent.id]: formSession ? [formSession] : [],
          }),
          currentSessionId && subSessions.length > 0
            ? seed.formSubSessions({ [currentSessionId]: subSessions })
            : {},
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

export const WithSubAgentForms: Story = {
  args: { agentType: "conversation", withMessages: true, withSubAgentForms: true },
  decorators: Default.decorators,
}
