import { AgentModel, DEFAULT_AGENT_MODEL } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import type { IAgentSettingsSpi } from "@/common/features/agents/agent-settings/agent-settings.spi"
import type { Agent } from "@/common/features/agents/agents.models"
import type { IAgentsSpi } from "@/common/features/agents/agents.spi"
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
  /** Unpublished draft revision — drives whether the header's publish button is enabled. */
  withDraft?: boolean
  /** Puts the agent on a retired model so the deprecation banner renders. */
  withDeprecatedModel?: boolean
}

/** Older revisions of the agent so the version history sheet has content to compare. */
function buildVersions(agentSettings: AgentSettings): AgentSettings[] {
  return [
    { ...agentSettings },
    {
      ...agentSettings,
      revision: 2,
      isDraft: false,
      name: "Stricter sourcing",
      description: "Requires the agent to cite a source for every factual claim.",
      temperature: 0.2,
      instructions: `${agentSettings.instructions}\nAlways cite your sources.`,
    },
    {
      ...agentSettings,
      revision: 1,
      isDraft: false,
      name: "Initial setup",
      instructions: "You are a helpful assistant.",
    },
  ]
}

/** Serves the seeded data back so history/restore interactions work inside the story. */
function buildMockAgentsService(agents: Agent[]): IAgentsSpi {
  return {
    getAll: async () => agents,
    getAllWithDrafts: async () => agents,
    createOne: async () => {
      throw new Error("createOne is not supported in this story")
    },
    updateOne: async () => {
      throw new Error("updateOne is not supported in this story")
    },
    deleteOne: async () => {
      throw new Error("deleteOne is not supported in this story")
    },
  }
}
function buildMockAgentSettingsService(agentSettingsHistory: AgentSettings[]): IAgentSettingsSpi {
  return {
    getAll: async () => agentSettingsHistory,
    getFillFormOutputJsonSchema: async ({ revision }) =>
      agentSettingsHistory.find((agentSettings) => agentSettings.revision === revision)
        ?.outputJsonSchema,
    updateOne: async () => {
      throw new Error("updateOne is not supported in this story")
    },

    restoreOne: async () => {
      throw new Error("restoreOne is not supported in this story")
    },
    createOne: async () => {
      throw new Error("createOne is not supported in this story")
    },
  }
}

const meta = {
  title: "routes/studio/project/agent/edit",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withSubAgents: { control: "boolean" },
    withDraft: { control: "boolean" },
    withDeprecatedModel: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    featureFlags: [...studioStoryArgs.featureFlags, "agent-orchestration"],
    withAgents: true,
    withSubAgents: true,
    withDraft: true,
    withDeprecatedModel: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agentEdit.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const ConversationAgent: Story = {
  decorators: [
    buildDecorator<StoryArgs>(({ withSubAgents, withDraft, withDeprecatedModel, ...args }) => {
      const { baseSeeds, agents } = buildStudioData({ ...args, withAgents: true })
      const [rawParentAgent, ...rawChildAgents] = agents
      if (!rawParentAgent) {
        throw new Error("Agent editor route story requires a parent agent")
      }
      const parentAgentSettings = {
        agentId: rawParentAgent.id,
        name: "Helpful Assistant",
        revision: 3,
        isDraft: !!withDraft,
        model: withDeprecatedModel ? AgentModel.Gemini25Flash : DEFAULT_AGENT_MODEL,
      } as AgentSettings
      const childAgents = rawChildAgents.map((agent, index) => ({
        ...agent,
        name: index === 0 ? "Research Agent" : "Summary Bot",
        type: "conversation" as const,
      }))
      const subAgents =
        withSubAgents && childAgents[0]
          ? [
              agentSubAgentFactory
                .transient({ parentAgent: rawParentAgent, childAgent: childAgents[0] })
                .build({
                  toolName: "ask_research_agent",
                  description: "Use for research and source discovery questions.",
                }),
            ]
          : []
      const allAgents = [rawParentAgent, ...childAgents]
      const versions = buildVersions(parentAgentSettings)

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.agents(allAgents, { currentId: rawParentAgent.id }),
          seed.studio.agentSubAgents(subAgents),
          seed.studio.documentTags([]),
          seed.studio.agentHistory({ agentId: rawParentAgent.id, versions }),
        ),
        services: {
          agents: buildMockAgentsService(allAgents),
          agentSettings: buildMockAgentSettingsService(versions),
        },
      }
    }),
  ],
}

export const ConversationAgentOnDeprecatedModel: Story = {
  args: { withDeprecatedModel: true },
  decorators: ConversationAgent.decorators,
}
