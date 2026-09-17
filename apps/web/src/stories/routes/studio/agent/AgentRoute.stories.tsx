import { AgentModel, DEFAULT_AGENT_MODEL } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import {
  conversationAgentSessionFactory,
  extractionAgentSessionSummaryFactory,
} from "@/common/features/agents/agent-sessions/agent-session.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import type { Agent } from "@/common/features/agents/agents.models"
import { buildDecorator, render } from "@/stories/decorators"
import { sortRecentlyCreated } from "@/stories/helpers"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type AgentType = Agent["type"]

type StoryArgs = StudioStoryArgs & {
  agentType: AgentType
  fillForm?: boolean
  withAgentSessions?: boolean
  /** Unpublished draft revision — drives whether the header's publish button is enabled. */
  withDraft?: boolean
  /** Puts the agent on a retired model so the deprecation banner renders. */
  withDeprecatedModel?: boolean
}

const meta = {
  title: "routes/studio/project/agent",
  parameters: { layout: "fullscreen" },
  argTypes: {
    ...studioStoryArgTypes,
    withAgents: { control: undefined },
    agentType: {
      control: "select",
      options: ["conversation", "extraction"] satisfies AgentType[],
    },
    fillForm: { control: "boolean" },
    withAgentSessions: { control: "boolean" },
    withDraft: { control: "boolean" },
    withDeprecatedModel: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    agentType: "conversation",
    fillForm: false,
    withAgentSessions: false,
    withDraft: false,
    withDeprecatedModel: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agent.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(
      ({ agentType, fillForm, withAgentSessions, withDraft, withDeprecatedModel, ...args }) => {
        const { baseSeeds, project, agents } = buildStudioData(args)
        const [firstAgent, ...restAgents] = agents
        const withFillForm = agentType === "conversation" && !!fillForm
        const currentAgent = agentFactory.transient({ project }).build({
          ...firstAgent,
          type: agentType,
          currentRevision: { number: 1 },
          // An unpublished draft revision is newer than the published one.
          draftRevision: withDraft ? { number: 2 } : undefined,
        })
        const currentAgentSettings = (
          withFillForm ? agentSettingsFactory.fillForm() : agentSettingsFactory
        )
          .transient({ agent: currentAgent })
          .build({
            revision: currentAgent.currentRevision.number,
            model: withDeprecatedModel ? AgentModel.Gemini25Flash : DEFAULT_AGENT_MODEL,
          })
        const draftAgentSettings = currentAgent.draftRevision
          ? { ...currentAgentSettings, revision: currentAgent.draftRevision.number, isDraft: true }
          : undefined

        const conversationSessionFactory = conversationAgentSessionFactory.transient({
          agent: currentAgent,
        })
        const conversationSessions =
          withAgentSessions && agentType === "conversation"
            ? // fillForm-enabled agents accumulate a form result on their sessions.
              (withFillForm ? conversationSessionFactory.withForm() : conversationSessionFactory)
                .buildList(3)
                .sort(sortRecentlyCreated)
            : []
        const extractionSessions =
          withAgentSessions && agentType === "extraction"
            ? extractionAgentSessionSummaryFactory
                .transient({ agent: currentAgent })
                .buildList(3)
                .sort(sortRecentlyCreated)
            : []

        return {
          state: mergeSeeds(
            baseSeeds,
            seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
            seed.conversationAgentSessions({ [currentAgent.id]: conversationSessions }),
            seed.extractionAgentSessions({
              [currentAgent.id]: { csvSessions: [], others: extractionSessions },
            }),
            seed.studio.agentHistory({
              agentId: currentAgent.id,
              versions: draftAgentSettings
                ? [draftAgentSettings, currentAgentSettings]
                : [currentAgentSettings],
            }),
          ),
        }
      },
    ),
  ],
}

export const AgentConvWithSessions: Story = {
  args: {
    organizationMembershipRole: "owner",
    projectMembershipRole: "owner",
    agentMembershipRole: "owner",
    featureFlags: [],
    withAgents: true,
    agentType: "conversation",
    fillForm: false,
    withAgentSessions: true,
  },
  decorators: Default.decorators,
}

export const AgentExtractionWithData: Story = {
  args: {
    ...AgentConvWithSessions.args,
    agentType: "extraction",
    // The extraction playground edits settings inline, so its header owns the publish action.
    withDraft: true,
  },
  decorators: Default.decorators,
}

export const AgentFillFormWithSessions: Story = {
  args: {
    ...AgentConvWithSessions.args,
    agentType: "conversation",
    fillForm: true,
  },
  decorators: Default.decorators,
}

export const AgentOnDeprecatedModel: Story = {
  args: {
    ...AgentConvWithSessions.args,
    withDeprecatedModel: true,
  },
  decorators: Default.decorators,
}
