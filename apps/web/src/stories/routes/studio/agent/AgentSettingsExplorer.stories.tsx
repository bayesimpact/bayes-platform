import { AgentModel, DocumentsRagMode } from "@bayes-platform/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import { agentFactory } from "@/common/features/agents/agent.factory"
import {
  agentOutputJsonSchemaFactory,
  agentSettingsFactory,
} from "@/common/features/agents/agent-settings/agent-settings.factory"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
import type { IAgentSettingsSpi } from "@/common/features/agents/agent-settings/agent-settings.spi"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { withRedux } from "@/stories/decorators"
import { mergeSeeds, seed } from "@/stories/seed"
import { AgentSettingsExplorer } from "@/studio/features/agents/agent-settings/components/AgentSettingsExplorer"

const organization = organizationFactory.build()
const project = projectFactory.transient({ organization }).build()

const agent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Helpful Assistant",
})

const baseSettings = agentSettingsFactory.transient({ agent }).build({
  instructions: "You are a helpful assistant.\nAnswer clearly and concisely.",
  model: AgentModel.Gemini25Flash,
  providerOptions: { temperature: 0.7 },
  documentsRagMode: DocumentsRagMode.None,
  greetingMessage: undefined,
  outputJsonSchema: undefined,
})

/** Revisions ordered newest first, as returned by the history endpoint. */
const versions: AgentSettings[] = [
  {
    ...baseSettings,
    revision: 4,
    isProduction: true,
    instructions:
      "You are a helpful assistant.\nAnswer clearly and concisely.\nAlways cite your sources.",
    providerOptions: { temperature: 0.3 },
    documentsRagMode: DocumentsRagMode.All,
    updatedAt: Date.now() - 1000 * 60 * 60,
  },
  {
    ...baseSettings,
    revision: 3,
    instructions:
      "You are a helpful assistant.\nAnswer clearly and concisely.\nAlways cite your sources.",
    providerOptions: { temperature: 0.3 },
    updatedAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    ...baseSettings,
    revision: 2,
    model: AgentModel.Gemini25Pro,
    greetingMessage: "Hi! How can I help you today?",
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
  },
  {
    ...baseSettings,
    revision: 1,
    instructions: "You are a helpful assistant.",
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
  },
]

const schemaAgent = agentFactory.transient({ project }).build({
  type: "extraction",
  name: "Document Extractor",
})

const schemaSettings = agentSettingsFactory.transient({ agent: schemaAgent }).build({
  outputJsonSchema: agentOutputJsonSchemaFactory.build(),
})

const schemaVersions: AgentSettings[] = [
  {
    ...schemaSettings,
    revision: 2,
    isProduction: true,
    outputJsonSchema: agentOutputJsonSchemaFactory.build({
      properties: {
        title: { type: "string", description: "Short title" },
        summary: { type: "string", description: "One-paragraph summary" },
        dueDate: { type: "string", description: "Due date if present" },
      },
    }),
    updatedAt: Date.now() - 1000 * 60 * 30,
  },
  {
    ...schemaSettings,
    revision: 1,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
]

/** Same history with a pending draft on top, saved automatically after an edit of the instructions. */
const versionsWithDraft: AgentSettings[] = [
  {
    ...baseSettings,
    revision: 5,
    isDraft: true,
    instructions:
      "You are a helpful assistant.\nAnswer clearly and concisely.\nAlways cite your sources.\nKeep answers under 200 words.",
    providerOptions: { temperature: 0.3 },
    documentsRagMode: DocumentsRagMode.All,
    updatedAt: Date.now() - 1000 * 60 * 5,
  },
  ...versions,
]

/**
 * Only the delete call runs in these stories. The mock store has no listener middleware, so the
 * history is not reloaded after a successful delete: the dialog closing is the visible outcome.
 */
function buildMockAgentSettingsService({ failDelete = false } = {}): IAgentSettingsSpi {
  const notUsed = () => Promise.reject(new Error("Not used in this story"))
  return {
    getAllWithDraft: notUsed,
    setProduction: notUsed,
    updateOne: notUsed,
    restoreOne: notUsed,
    createOne: notUsed,
    archiveOne: () =>
      failDelete ? Promise.reject(new Error("Delete failed")) : Promise.resolve({ success: true }),
  }
}

/** The explorer reads the current agent id from the store, so both must be seeded together. */
function seedHistory(currentAgent: typeof agent, agentSettings: AgentSettings[]) {
  return mergeSeeds(
    seed.organizations([organization]),
    seed.projects([project]),
    seed.agents([currentAgent], { currentId: currentAgent.id }),
    seed.studio.agentHistory({ agentId: currentAgent.id, versions: agentSettings }),
  )
}

const meta = {
  title: "routes/studio/project/agent/AgentSettingsExplorer",
  component: AgentSettingsExplorer,
  render: (args) => (
    <div className="flex h-[600px] flex-col border">
      <AgentSettingsExplorer {...args} />
    </div>
  ),
} satisfies Meta<typeof AgentSettingsExplorer>

export default meta
type Story = StoryObj<typeof meta>

export const ManyVersions: Story = {
  decorators: [withRedux({ state: seedHistory(agent, versions) })],
}

export const SchemaChange: Story = {
  decorators: [withRedux({ state: seedHistory(schemaAgent, schemaVersions) })],
}

export const SingleVersion: Story = {
  decorators: [
    withRedux({
      state: seedHistory(agent, [{ ...baseSettings, revision: 1, isProduction: true }]),
    }),
  ],
}

/** Version 2 stays in production while 3 and 4 are saved, with a draft on top. */
const olderProductionVersions: AgentSettings[] = [
  {
    ...baseSettings,
    revision: 5,
    isDraft: true,
    instructions:
      "You are a helpful assistant.\nAnswer clearly and concisely.\nAlways cite your sources.\nOffer a next step.",
    updatedAt: Date.now() - 1000 * 60 * 10,
  },
  ...versions.map((version) => ({ ...version, isProduction: version.revision === 2 })),
]

/** The same agent, as the agents list names its versions for that history. */
const agentWithOlderProduction = agentFactory.transient({ project }).build({
  id: agent.id,
  type: agent.type,
  name: agent.name,
  currentRevision: { number: 2 },
  latestSavedRevision: { number: 4 },
  draftRevision: { number: 5 },
})

export const OlderVersionInProduction: Story = {
  decorators: [
    withRedux({
      state: seedHistory(agentWithOlderProduction, olderProductionVersions),
    }),
  ],
}

/** Version 3 is selected by default: an older published version, so it can be deleted. */
export const DeleteOlderVersion: Story = {
  decorators: [
    withRedux({
      state: seedHistory(agent, versions),
      services: { agentSettings: buildMockAgentSettingsService() },
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: /delete/i }))
    const dialog = within(canvasElement.ownerDocument.body)
    await expect(await dialog.findByRole("dialog")).toBeInTheDocument()
  },
}

export const DeleteFails: Story = {
  decorators: [
    withRedux({
      state: seedHistory(agent, versions),
      services: { agentSettings: buildMockAgentSettingsService({ failDelete: true }) },
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: /delete/i }))
    const body = within(canvasElement.ownerDocument.body)
    const dialog = within(await body.findByRole("dialog"))
    await userEvent.click(dialog.getByRole("button", { name: /delete/i }))
    await expect(await dialog.findByRole("alert")).toBeInTheDocument()
  },
}

/** The version in production cannot be deleted: the button is disabled and says why. */
export const DeleteBlockedProduction: Story = {
  args: { initialRevision: 4 },
  decorators: [
    withRedux({
      state: seedHistory(agent, versions),
      services: { agentSettings: buildMockAgentSettingsService() },
    }),
  ],
}

/** The pending draft is selected by default: the button discards it and goes back to version 4. */
export const DiscardDraft: Story = {
  decorators: [
    withRedux({
      state: seedHistory(agent, versionsWithDraft),
      services: { agentSettings: buildMockAgentSettingsService() },
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole("button", { name: /discard draft/i }))
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByRole("dialog")).toBeInTheDocument()
  },
}

/** A copy of an agent starts with a draft only: discarding it would leave the agent without settings. */
export const DiscardDraftNeverSaved: Story = {
  decorators: [
    withRedux({
      state: seedHistory(agent, [{ ...baseSettings, revision: 1, isDraft: true }]),
      services: { agentSettings: buildMockAgentSettingsService() },
    }),
  ],
}
