import { ToolName } from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import {
  agentSessionMessageFactory,
  conversationAgentSessionFactory,
  conversationSubSessionFactory,
} from "@/common/features/agents/agent-sessions/agent-session.factory"
import { agentSettingsFactory } from "@/common/features/agents/settings/agent-settings.factory"
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
  draftVersion?: boolean
  spanTwoVersions?: boolean
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
    draftVersion: { control: "boolean" },
    spanTwoVersions: { control: "boolean" },
  },
  args: {
    ...studioStoryArgs,
    withAgents: true,
    fillForm: false,
    withMessages: true,
    withSubAgentForms: false,
    draftVersion: false,
    spanTwoVersions: false,
  },
  render: render({ routes: studioRoutes, path: StudioRoutes.agentSession.path }),
} satisfies Meta<StoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [
    buildDecorator<StoryArgs>(
      ({ fillForm, withMessages, withSubAgentForms, draftVersion, spanTwoVersions, ...args }) => {
        const { baseSeeds, project, agents } = buildStudioData(args)
        const [firstAgent, ...restAgents] = agents

        const currentAgent = agentFactory
          .transient({ project })
          .build({ ...firstAgent, type: "conversation" })

        // The playground header names the newest revision, drafts included. Two revisions so the
        // draft story shows an unpublished v2 sitting on top of the published v1.
        const publishedSettings = agentSettingsFactory.transient({ agent: currentAgent }).build({
          revision: 1,
          revisionName: "Baseline",
          revisionDesc: "The first published settings for this agent.",
        })
        const draftSettings = agentSettingsFactory.transient({ agent: currentAgent }).build({
          revision: 2,
          revisionName: "Friendlier tone",
          revisionDesc: "Adds a greeting message and raises the temperature for warmer replies.",
          isDraft: true,
        })
        // Revision desc order, newest first, matching the API's list order.
        const settingsRevisions =
          draftVersion || spanTwoVersions ? [draftSettings, publishedSettings] : [publishedSettings]

        const sessionFactory = conversationAgentSessionFactory.transient({ agent: currentAgent })
        // fillForm-enabled agents accumulate a form result on the session, shown in the sheet.
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

        const assistantMessage = agentSessionMessageFactory.build({
          role: "assistant",
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        })

        // A revision the assistant turns ran on. When the session spans two, the later turn ran on
        // the draft, which is what puts a second marker in the transcript.
        const ranOn = (settings: typeof publishedSettings) => ({
          revision: settings.revision,
          revisionName: settings.revisionName,
          isDraft: settings.isDraft,
        })
        const firstTurnSettings = ranOn(publishedSettings)
        const secondTurnSettings = spanTwoVersions ? ranOn(draftSettings) : firstTurnSettings

        const messages = withMessages
          ? [
              agentSessionMessageFactory.build({ role: "user" }),
              agentSessionMessageFactory.build({
                ...assistantMessage,
                agentSettings: firstTurnSettings,
              }),
              agentSessionMessageFactory.build({ role: "user" }),
              agentSessionMessageFactory.build({
                role: "assistant",
                agentSettings: secondTurnSettings,
              }),
            ]
          : []

        return {
          state: mergeSeeds(
            baseSeeds,
            seed.agents([...restAgents, currentAgent], { currentId: currentAgent.id }),
            seed.studio.agentSettings(settingsRevisions),
            seed.conversationAgentSessions({ [currentAgent.id]: [session] }),
            subSessions.length > 0
              ? seed.conversationSubSessions({ [session.id]: subSessions })
              : {},
            seed.currentAgentSessionId(session.id),
            seed.agentSessionMessages(messages),
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

export const DraftVersion: Story = {
  args: { draftVersion: true },
  decorators: Default.decorators,
}

export const SpanningTwoVersions: Story = {
  args: { withMessages: true, spanTwoVersions: true },
  decorators: Default.decorators,
}
