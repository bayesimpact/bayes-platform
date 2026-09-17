import { ToolName } from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import {
  agentSessionMessageFactory,
  conversationAgentSessionFactory,
  conversationSubSessionFactory,
} from "@/common/features/agents/agent-sessions/agent-session.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
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
  withVersionHistory?: boolean
  withPendingDraft?: boolean
  pinnedRevision?: number
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
    withVersionHistory: { control: "boolean" },
    withPendingDraft: { control: "boolean" },
    pinnedRevision: { control: "number" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    fillForm: false,
    withMessages: true,
    withSubAgentForms: false,
    withVersionHistory: true,
    withPendingDraft: false,
    pinnedRevision: undefined,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agentSession.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(
      ({
        fillForm,
        withMessages,
        withSubAgentForms,
        withVersionHistory,
        withPendingDraft,
        pinnedRevision,
        ...args
      }) => {
        const { baseSeeds, project, agents } = buildStudioData(args)
        const [firstAgent, ...restAgents] = agents

        const currentAgent = agentFactory.transient({ project }).build({
          ...firstAgent,
          type: "conversation",
          currentRevision: { number: 2 },
          draftRevision: withPendingDraft ? { number: 3 } : undefined,
        })
        const currentAgentSettings = (
          fillForm ? agentSettingsFactory.fillForm() : agentSettingsFactory
        )
          .transient({ agent: currentAgent })
          .build({ revision: currentAgent.currentRevision.number })

        const sessionFactory = conversationAgentSessionFactory.transient({ agent: currentAgent })
        // fillForm-enabled agents accumulate a form result on the session, shown in the sheet.
        const session = (fillForm ? sessionFactory.withForm() : sessionFactory).build()

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

        const toolCalls = [
          ...(fillForm
            ? [{ id: faker.string.uuid(), name: ToolName.FillForm, arguments: {} }]
            : []),
          ...(withSubAgentForms
            ? subSessions.map((subSession) => ({
                id: faker.string.uuid(),
                name: subSession.toolName,
                arguments: {},
              }))
            : []),
        ]

        // Versions newest first, as the history endpoint returns them. The playground runs
        // the newest published one; a pending draft is newer but not live.
        const versions: AgentSettings[] = withVersionHistory
          ? [
              ...(withPendingDraft
                ? [
                    {
                      ...currentAgentSettings,
                      revision: 3,
                      isDraft: true,
                      updatedAt: Date.now(),
                    },
                  ]
                : []),
              {
                ...currentAgentSettings,
                revision: 2,
                isDraft: false,
                name: "Tighter tone",
                updatedAt: Date.now() - 1000 * 60 * 60,
              },
              {
                ...currentAgentSettings,
                revision: 1,
                isDraft: false,
                name: "First release",
                updatedAt: Date.now() - 1000 * 60 * 60 * 48,
              },
            ]
          : [currentAgentSettings]

        const assistantMessage = agentSessionMessageFactory.build({
          role: "assistant",
          agentRevision: 1,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        })

        // The last turn ran on the newer revision, so the footers show different versions.
        const messages = withMessages
          ? [
              agentSessionMessageFactory.build({ role: "user", agentRevision: 1 }),
              assistantMessage,
              agentSessionMessageFactory.build({ role: "user", agentRevision: 2 }),
              agentSessionMessageFactory.build({ role: "assistant", agentRevision: 2 }),
            ]
          : []

        return {
          state: mergeSeeds(
            baseSeeds,
            seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
            seed.conversationAgentSessions({ [currentAgent.id]: [session] }),
            subSessions.length > 0
              ? seed.conversationSubSessions({ [session.id]: subSessions })
              : {},
            seed.currentAgentSessionId(session.id),
            seed.agentSessionMessages(messages),
            seed.studio.agentHistory({ agentId: currentAgent.id, versions }),
            pinnedRevision !== undefined
              ? seed.studio.playgroundRevision({
                  agentId: currentAgent.id,
                  revision: pinnedRevision,
                })
              : {},
          ),
        }
      },
    ),
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

/** A draft exists, so the playground defaults to running it and the header select turns amber. */
export const WithPendingDraft: Story = {
  args: { withVersionHistory: true, withPendingDraft: true },
  decorators: Default.decorators,
}

/** A draft exists but the tester pinned the published version, so nothing unpublished runs. */
export const WithPublishedPinned: Story = {
  args: { withVersionHistory: true, withPendingDraft: true, pinnedRevision: 2 },
  decorators: Default.decorators,
}

/** A member who cannot manage the agent sees no version indicators. */
export const NonManager: Story = {
  args: { agentMembershipRole: "member", withVersionHistory: true },
  decorators: Default.decorators,
}

/** An agent with a single version: the picker renders with nothing to switch to. */
export const WithoutVersionHistory: Story = {
  args: { withVersionHistory: false },
  decorators: Default.decorators,
}
