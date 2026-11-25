import { AgentModel } from "@bayes-platform/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import {
  agentFactory,
  agentModelsCatalogFactory,
  defaultAgentModels,
} from "@/common/features/agents/agent.factory"
import {
  conversationAgentSessionFactory,
  extractionAgentSessionSummaryFactory,
} from "@/common/features/agents/agent-sessions/agent-session.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import type { Agent } from "@/common/features/agents/agents.models"
import { buildDecorator, render } from "@/stories/decorators"
import { sortRecentlyCreated } from "@/stories/helpers"
import {
  buildAgentVersions,
  buildAgentVersionsBackend,
} from "@/stories/routes/studio/agent/agent-versions"
import {
  buildStudioData,
  type StudioStoryArgs,
  studioStoryArgs,
  studioStoryArgTypes,
} from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import { mcpServerFactory } from "@/studio/features/mcp-servers/mcp-servers.factory"
import { StudioRoutes } from "@/studio/routes/helpers"
import { studioRoutes } from "@/studio/routes/StudioRoutes"

type AgentType = Agent["type"]

type StoryArgs = StudioStoryArgs & {
  agentType: AgentType
  fillForm?: boolean
  withAgentSessions?: boolean
  /** Unpublished draft revision — drives whether the header's publish button is enabled. */
  withDraft?: boolean
  /** A fresh copy: its settings are draft revision 1, and it was never published. */
  unpublished?: boolean
  /** Puts the agent on a retired model so the deprecation banner renders. */
  withDeprecatedModel?: boolean
  /** Grants the safety review of the current agent: the header shows the safety entry. */
  canReviewConversations?: boolean
  /** Lists MCP servers in the project and turns on `agent-mcp`: the editor shows its MCP tab. */
  withMcpServers?: boolean
  /** How many saved revisions the agent has. */
  savedCount?: number
  /** Saved revision in production; the newest saved one when unset. */
  productionRevision?: number
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
    unpublished: { control: "boolean" },
    withDeprecatedModel: { control: "boolean" },
    canReviewConversations: { control: "boolean" },
    withMcpServers: { control: "boolean" },
    savedCount: { control: { type: "number", min: 1, max: 5 } },
    productionRevision: { control: { type: "number", min: 1 } },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    agentType: "conversation",
    fillForm: false,
    withAgentSessions: false,
    withDraft: false,
    unpublished: false,
    withDeprecatedModel: false,
    canReviewConversations: false,
    withMcpServers: false,
    savedCount: 1,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agent.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(
      ({
        agentType,
        fillForm,
        withAgentSessions,
        withDraft,
        unpublished,
        withDeprecatedModel,
        canReviewConversations,
        withMcpServers,
        savedCount = 1,
        productionRevision,
        ...args
      }) => {
        const { baseSeeds, user, project, agents } = buildStudioData(
          withMcpServers
            ? { ...args, featureFlags: [...(args.featureFlags ?? []), "agent-mcp"] }
            : args,
        )
        const [firstAgent, ...restAgents] = agents
        const withFillForm = agentType === "conversation" && !!fillForm
        const rawAgent = unpublished
          ? agentFactory
              .unpublished()
              .transient({ project })
              .build({ id: firstAgent?.id, name: firstAgent?.name, type: agentType })
          : agentFactory.transient({ project }).build({ ...firstAgent, type: agentType })
        const baseSettings = (withFillForm ? agentSettingsFactory.fillForm() : agentSettingsFactory)
          .transient({ agent: rawAgent })
          .build({
            revision: 1,
            model: withDeprecatedModel ? AgentModel.Gemini25Flash : defaultAgentModels.agent,
          })
        // A copy that was never saved only has its draft; otherwise saved revisions, one of them
        // in production, and the draft on top when there is one.
        const backend = buildAgentVersionsBackend(
          unpublished
            ? { agent: rawAgent, versions: [{ ...baseSettings, isDraft: true }] }
            : buildAgentVersions({
                agent: rawAgent,
                base: baseSettings,
                savedCount,
                productionRevision,
                withDraft,
              }),
        )
        const currentAgent = backend.getAgent()

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
            seed.me({
              ...user,
              conversationReviewAgentIds: canReviewConversations ? [currentAgent.id] : [],
            }),
            seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
            seed.conversationAgentSessions({ [currentAgent.id]: conversationSessions }),
            seed.extractionAgentSessions({
              [currentAgent.id]: { csvSessions: [], others: extractionSessions },
            }),
            seed.studio.agentHistory({ agentId: currentAgent.id, versions: backend.getVersions() }),
            // The extraction page embeds the agent editor, which lists the project's MCP servers.
            seed.studio.mcpServers(
              withMcpServers ? mcpServerFactory.transient({ project }).buildList(2) : [],
            ),
          ),
          services: {
            agents: {
              getAll: async () => [...restAgents, backend.getAgent()],
              getAllWithDrafts: async () => [...restAgents, backend.getAgent()],
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
            },
            agentSettings: backend.agentSettings,
          },
        }
      },
    ),
  ],
}

/**
 * Five saved versions, version 2 in production: the header says which one is live, and the
 * managers switch it from there.
 */
export const AgentOlderVersionInProduction: Story = {
  args: { savedCount: 5, productionRevision: 2 },
  decorators: Default.decorators,
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

/** The extraction playground's editor with the project's MCP servers: it shows the MCP tab. */
export const AgentExtractionWithMcpServers: Story = {
  args: { ...AgentExtractionWithData.args, withMcpServers: true },
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

export const AgentConvForConversationReviewer: Story = {
  args: {
    ...AgentConvWithSessions.args,
    canReviewConversations: true,
  },
  decorators: Default.decorators,
}

/** A fresh copy of an agent: its settings are a draft that was never published. */
export const AgentUnpublishedCopy: Story = {
  args: {
    ...AgentConvWithSessions.args,
    withAgentSessions: false,
    unpublished: true,
  },
  decorators: Default.decorators,
}

/** The duplicate dialog of an agent with a draft: the copy starts from the draft or the published version. */
export const AgentDuplicateWithDraft: Story = {
  args: {
    ...AgentConvWithSessions.args,
    withAgentSessions: false,
    withDraft: true,
  },
  decorators: Default.decorators,
  play: async ({ canvasElement }) => {
    // The dialog renders in a portal, outside the story's canvas.
    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(await page.findByRole("button", { name: "Duplicate" }))
    const dialog = await page.findByRole("dialog", { name: "Duplicate Agent" })
    await expect(within(dialog).getByRole("radio", { name: /Draft \(version 2\)/ })).toBeChecked()
  },
}
