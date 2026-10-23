import { AgentModel } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  agentFactory,
  agentModelsCatalogFactory,
  defaultAgentModels,
} from "@/common/features/agents/agent.factory"
import { conversationAgentSessionFactory } from "@/common/features/agents/agent-sessions/agent-session.factory"
import type { IConversationAgentSessionsSpi } from "@/common/features/agents/agent-sessions/conversation/conversation-agent-sessions.spi"
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
  /** Turns the priority tier on; pair it with the `llm-priority-calls` flag to see the toggle. */
  withPriorityCalls?: boolean
  /** A fresh copy: its only revision is draft 1, never published. */
  unpublished?: boolean
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
    getAvailableModels: async () => agentModelsCatalogFactory.build(),
    createOne: async () => {
      throw new Error("createOne is not supported in this story")
    },
    duplicateOne: async () => {
      throw new Error("duplicateOne is not supported in this story")
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
    getAllWithDraft: async () => agentSettingsHistory,
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
/** Creates a playground session on demand so the "Start chat" flow works inside the story. */
function buildMockConversationAgentSessionsService(): IConversationAgentSessionsSpi {
  return {
    getAll: async () => [],
    createOne: async (params) =>
      conversationAgentSessionFactory
        .transient({ agent: { id: params.agentId } })
        .build({ type: "playground" }),
    deleteOne: async () => {
      throw new Error("deleteOne is not supported in this story")
    },
    listSubSessions: async () => [],
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
    withPriorityCalls: { control: "boolean" },
    unpublished: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    featureFlags: [...studioStoryArgs.featureFlags, "agent-orchestration"],
    withAgents: true,
    withSubAgents: true,
    withDraft: true,
    withDeprecatedModel: false,
    withPriorityCalls: false,
    unpublished: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agentEdit.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const ConversationAgent: Story = {
  decorators: [
    buildDecorator<StoryArgs>(
      ({
        withSubAgents,
        withDraft,
        withDeprecatedModel,
        withPriorityCalls,
        unpublished,
        ...args
      }) => {
        const { baseSeeds, agents, project } = buildStudioData({ ...args, withAgents: true })
        const [firstAgent, ...rawChildAgents] = agents
        if (!firstAgent) {
          throw new Error("Agent editor route story requires a parent agent")
        }
        const rawParentAgent = unpublished
          ? agentFactory
              .unpublished()
              .transient({ project })
              .build({ id: firstAgent.id, name: firstAgent.name, type: firstAgent.type })
          : firstAgent
        const parentAgentSettings = {
          agentId: rawParentAgent.id,
          name: "Helpful Assistant",
          revision: 3,
          isDraft: !!withDraft,
          model: withDeprecatedModel ? AgentModel.Gemini25Flash : defaultAgentModels.agent,
          priorityCallsEnabled: !!withPriorityCalls,
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
        const versions = unpublished
          ? [{ ...parentAgentSettings, revision: 1, isDraft: true }]
          : buildVersions(parentAgentSettings)

        return {
          state: mergeSeeds(
            baseSeeds,
            seed.agents(allAgents, { currentId: rawParentAgent.id }),
            seed.studio.agentSubAgents(subAgents),
            seed.studio.documentTags([]),
            seed.studio.agentHistory({ agentId: rawParentAgent.id, versions }),
            // The agent layout above the editor lists the agent's conversations.
            seed.conversationAgentSessions({ [rawParentAgent.id]: [] }),
            seed.studio.mcpServers([]),
          ),
          services: {
            agents: buildMockAgentsService(allAgents),
            agentSettings: buildMockAgentSettingsService(versions),
          },
        }
      },
    ),
  ],
}

/** A fresh copy of an agent opens here: its settings are a draft that was never published. */
export const ConversationAgentUnpublishedCopy: Story = {
  args: { unpublished: true, withSubAgents: true },
  decorators: ConversationAgent.decorators,
}

export const ConversationAgentOnDeprecatedModel: Story = {
  args: { withDeprecatedModel: true },
  decorators: ConversationAgent.decorators,
}

/** The Model tab shows the priority tier toggle: flag on, Gemini 3.x model, option already on. */
export const ConversationAgentWithPriorityCalls: Story = {
  args: {
    featureFlags: [...studioStoryArgs.featureFlags, "agent-orchestration", "llm-priority-calls"],
    withPriorityCalls: true,
  },
  decorators: ConversationAgent.decorators,
}

/**
 * The General tab with the prompt-variables section: the agent's instructions (edited right
 * above it) declare `{{topic}}` and the settings hold a default for it, so the section renders
 * with that default filled in.
 */
export const GeneralTabWithPromptVariables: Story = {
  args: {
    featureFlags: ["agent-prompt-variables"],
    withAgents: true,
  },
  decorators: [
    buildDecorator<StoryArgs>((args) => {
      const { baseSeeds, agents, project } = buildStudioData({ ...args, withAgents: true })
      const [firstAgent] = agents
      if (!firstAgent) {
        throw new Error("Prompt variables route story requires an agent")
      }
      // The factory randomizes the agent type; the embed tab only exists for conversation agents.
      const agent = agentFactory.transient({ project }).build({
        id: firstAgent.id,
        name: "Helpful Assistant",
        type: "conversation",
        currentRevision: { number: 3 },
      })
      const agentSettings = {
        agentId: agent.id,
        name: "Helpful Assistant",
        description: "Answers questions about a given topic.",
        revision: 3,
        isDraft: false,
        model: defaultAgentModels.agent,
        instructions: "You are a helpful assistant. Answer the user's questions about {{topic}}.",
        variables: { topic: "The new pricing page" } as Record<string, string>,
      } as AgentSettings

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.agents([agent], { currentId: agent.id }),
          seed.studio.agentHistory({ agentId: agent.id, versions: [agentSettings] }),
          seed.conversationAgentSessions({ [agent.id]: [] }),
          seed.studio.documentTags([]),
          seed.studio.mcpServers([]),
        ),
        services: {
          agents: buildMockAgentsService([agent]),
          agentSettings: buildMockAgentSettingsService([agentSettings]),
        },
      }
    }),
  ],
}

/**
 * Starting a playground chat for an agent whose instructions declare {{variables}}: the
 * sidebar's "New Chat" opens a dialog to collect the values instead of creating the session
 * right away. {{topic}} has a default in the settings, so its field is optional and "Start
 * chat" is enabled from the start; blanks fall back to the default.
 */
export const PlaygroundSessionStartWithPromptVariables: Story = {
  args: {
    featureFlags: ["agent-prompt-variables"],
    withAgents: true,
  },
  decorators: [
    buildDecorator<StoryArgs>((args) => {
      // isStudioInterface() reads window.location, which still points at Storybook inside the
      // story iframe: serve the studio prefix so the session the story creates is a "playground" one.
      window.history.pushState({}, "", StudioRoutes.home.path)
      const { baseSeeds, agents, project } = buildStudioData({ ...args, withAgents: true })
      const [firstAgent] = agents
      if (!firstAgent) {
        throw new Error("Prompt variables session story requires an agent")
      }
      // The factory randomizes the agent type; the session creator only supports conversation.
      const agent = agentFactory.transient({ project }).build({
        id: firstAgent.id,
        name: "Helpful Assistant",
        type: "conversation",
        currentRevision: { number: 3 },
      })
      const agentSettings = {
        agentId: agent.id,
        name: "Helpful Assistant",
        description: "Answers questions about a given topic.",
        revision: 3,
        isDraft: false,
        model: defaultAgentModels.agent,
        instructions: "You are a helpful assistant. Answer the user's questions about {{topic}}.",
        variables: { topic: "The new pricing page" } as Record<string, string>,
      } as AgentSettings

      return {
        state: mergeSeeds(
          baseSeeds,
          seed.agents([agent], { currentId: agent.id }),
          seed.studio.agentHistory({ agentId: agent.id, versions: [agentSettings] }),
          seed.conversationAgentSessions({ [agent.id]: [] }),
          seed.studio.documentTags([]),
          seed.studio.mcpServers([]),
        ),
        services: {
          agents: buildMockAgentsService([agent]),
          agentSettings: buildMockAgentSettingsService([agentSettings]),
          conversationAgentSessions: buildMockConversationAgentSessionsService(),
        },
      }
    }),
  ],
}
