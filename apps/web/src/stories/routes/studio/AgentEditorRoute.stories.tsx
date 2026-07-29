import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Agent } from "@/common/features/agents/agents.models"
import type { IAgentsSpi } from "@/common/features/agents/agents.spi"
import { agentSettingsFactory } from "@/common/features/agents/settings/agent-settings.factory"
import type { AgentSettings } from "@/common/features/agents/settings/agent-settings.models"
import type { IAgentSettingsSpi } from "@/common/features/agents/settings/agent-settings.spi"
import { buildDecorator, render } from "@/stories/decorators"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { agentSubAgentFactory } from "@/studio/features/agent-sub-agents/agent-sub-agents.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type StoryArgs = StudioStoryArgs & {
  withSubAgents?: boolean
}

/** Older revisions of the agent's settings so the version history sheet has content to compare. */
function buildAgentSettingsVersions(agent: Agent): AgentSettings[] {
  const latest = agentSettingsFactory.transient({ agent }).build({ revision: 3 })
  return [
    latest,
    agentSettingsFactory.transient({ agent }).build({
      revision: 2,
      temperature: 0.2,
      instructions: `${latest.instructions}\nAlways cite your sources.`,
    }),
    agentSettingsFactory.transient({ agent }).build({
      revision: 1,
      instructions: "You are a helpful assistant.",
    }),
  ]
}

/** Serves the seeded agents back so orchestration lookups work inside the story. */
function buildMockAgentsService(agents: Agent[]): IAgentsSpi {
  return {
    getAll: async () => agents,
    createOne: async () => {
      throw new Error("createOne is not supported in this story")
    },
    updateOne: async () => {},
    updateDocumentTags: async () => {},
    updateResourceLibraries: async () => {},
    updateSessionCategories: async () => {},
    deleteOne: async () => {},
  }
}

/** Serves the seeded revisions back so history/restore interactions work inside the story. */
function buildMockAgentSettingsService(versions: AgentSettings[]): IAgentSettingsSpi {
  return {
    getAll: async () => versions,
    updateOne: async () => {
      throw new Error("updateOne is not supported in this story")
    },
    publishOne: async () => {
      throw new Error("publishOne is not supported in this story")
    },
    archiveOne: async () => {},
    restoreOne: async () => {},
  }
}

const meta = {
  title: "routes/studio/project/agent/edit",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withSubAgents: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    featureFlags: [...studioStoryArgs.featureFlags, "agent-orchestration"],
    withAgents: true,
    withSubAgents: true,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agentEdit.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const ConversationAgent: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withSubAgents, ...args }) => {
      const { baseSeeds, agents } = buildStudioData({ ...args, withAgents: true })
      const [rawParentAgent, ...rawChildAgents] = agents
      if (!rawParentAgent) {
        throw new Error("Agent editor route story requires a parent agent")
      }
      const parentAgent = {
        ...rawParentAgent,
        name: "Helpful Assistant",
        type: "conversation" as const,
      }
      const childAgents = rawChildAgents.map((agent, index) => ({
        ...agent,
        name: index === 0 ? "Research Agent" : "Summary Bot",
        type: "conversation" as const,
      }))
      const subAgents =
        withSubAgents && childAgents[0]
          ? [
              agentSubAgentFactory.transient({ parentAgent, childAgent: childAgents[0] }).build({
                toolName: "ask_research_agent",
                description: "Use for research and source discovery questions.",
              }),
            ]
          : []
      const allAgents = [parentAgent, ...childAgents]
      const versions = buildAgentSettingsVersions(parentAgent)

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.agents(allAgents, { currentId: parentAgent.id }),
          seed.studio.agentSubAgents(subAgents),
          seed.studio.documentTags([]),
          seed.studio.agentSettings(versions),
          // `ConversationAgentSessionsRoute` wraps every nested route under the agent, including
          // this edit page, and gates on the session list being loaded.
          seed.conversationAgentSessions({ [parentAgent.id]: [] }),
        ),
        services: {
          agents: buildMockAgentsService(allAgents),
          agentSettings: buildMockAgentSettingsService(versions),
        },
      }
    }),
  ],
}
