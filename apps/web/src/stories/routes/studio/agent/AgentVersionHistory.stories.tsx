import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory, agentOutputJsonSchemaFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/settings/agent-settings.factory"
import type { AgentSettings } from "@/common/features/agents/settings/agent-settings.models"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { withRedux } from "@/stories/decorators"
import { seed } from "@/stories/seed"
import { AgentVersionExplorer } from "@/studio/features/agents/components/AgentVersionExplorer"

const organization = organizationFactory.build()
const project = projectFactory.transient({ organization }).build()

const baseAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Helpful Assistant",
})

/**
 * Revisions ordered newest first, as returned by the settings endpoint. Naming a revision is
 * optional, so 4 and 2 carry a name and description while 3 and 1 stay unnamed.
 */
const versions: AgentSettings[] = [
  agentSettingsFactory.transient({ agent: baseAgent }).build({
    revision: 4,
    revisionName: "Cite sources",
    revisionDesc: "Requires a source for every answer and widens retrieval to all documents.",
    instructions:
      "You are a helpful assistant.\nAnswer clearly and concisely.\nAlways cite your sources.",
    model: AgentModel.Gemini25Flash,
    temperature: 0.3,
    locale: AgentLocale.EN,
    documentsRagMode: DocumentsRagMode.All,
    updatedAt: Date.now() - 1000 * 60 * 60,
  }),
  agentSettingsFactory.transient({ agent: baseAgent }).build({
    revision: 3,
    instructions:
      "You are a helpful assistant.\nAnswer clearly and concisely.\nAlways cite your sources.",
    model: AgentModel.Gemini25Flash,
    temperature: 0.3,
    locale: AgentLocale.EN,
    documentsRagMode: DocumentsRagMode.None,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24,
  }),
  agentSettingsFactory.transient({ agent: baseAgent }).build({
    revision: 2,
    revisionName: "Friendlier tone",
    revisionDesc: "Adds a greeting message and raises the temperature for warmer replies.",
    instructions: "You are a helpful assistant.\nAnswer clearly and concisely.",
    model: AgentModel.Gemini25Pro,
    temperature: 0.7,
    locale: AgentLocale.EN,
    documentsRagMode: DocumentsRagMode.None,
    greetingMessage: "Hi! How can I help you today?",
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
  }),
  agentSettingsFactory.transient({ agent: baseAgent }).build({
    revision: 1,
    instructions: "You are a helpful assistant.",
    model: AgentModel.Gemini25Flash,
    temperature: 0.7,
    locale: AgentLocale.EN,
    documentsRagMode: DocumentsRagMode.None,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
  }),
]

/**
 * A draft newest revision sitting on top of an older published one: the draft badge, the live
 * badge on the published revision below it, and the publish action must all be visible.
 */
const draftVersions: AgentSettings[] = [
  agentSettingsFactory.transient({ agent: baseAgent }).build({
    revision: 2,
    isDraft: true,
    revisionName: "Double-check facts",
    revisionDesc: "Asks the agent to verify claims before answering.",
    instructions:
      "You are a helpful assistant.\nAnswer clearly, concisely, and always double-check facts before responding.",
    model: AgentModel.Gemini25Flash,
    temperature: 0.3,
    locale: AgentLocale.EN,
    documentsRagMode: DocumentsRagMode.All,
    updatedAt: Date.now() - 1000 * 60 * 10,
  }),
  agentSettingsFactory.transient({ agent: baseAgent }).build({
    revision: 1,
    instructions: "You are a helpful assistant.",
    model: AgentModel.Gemini25Flash,
    temperature: 0.7,
    locale: AgentLocale.EN,
    documentsRagMode: DocumentsRagMode.None,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
  }),
]

const schemaAgent = agentFactory.transient({ project }).build({
  type: "extraction",
  name: "Document Extractor",
})

const schemaVersions: AgentSettings[] = [
  agentSettingsFactory.transient({ agent: schemaAgent }).build({
    revision: 2,
    outputJsonSchema: agentOutputJsonSchemaFactory.build({
      properties: {
        title: { type: "string", description: "Short title" },
        summary: { type: "string", description: "One-paragraph summary" },
        dueDate: { type: "string", description: "Due date if present" },
      },
    }),
    updatedAt: Date.now() - 1000 * 60 * 30,
  }),
  agentSettingsFactory.transient({ agent: schemaAgent }).build({
    revision: 1,
    outputJsonSchema: agentOutputJsonSchemaFactory.build(),
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  }),
]

const meta = {
  title: "routes/studio/project/agent/AgentVersionHistory",
  component: AgentVersionExplorer,
  render: () => (
    <div className="flex h-[600px] flex-col border">
      <AgentVersionExplorer />
    </div>
  ),
} satisfies Meta<typeof AgentVersionExplorer>

export default meta
type Story = StoryObj<typeof meta>

export const ManyVersions: Story = {
  decorators: [withRedux({ state: seed.studio.agentSettings(versions) })],
}

export const SchemaChange: Story = {
  decorators: [withRedux({ state: seed.studio.agentSettings(schemaVersions) })],
}

export const DraftPendingPublish: Story = {
  decorators: [withRedux({ state: seed.studio.agentSettings(draftVersions) })],
}

export const SingleVersion: Story = {
  decorators: [
    withRedux({
      state: seed.studio.agentSettings([
        agentSettingsFactory.transient({ agent: baseAgent }).build({ revision: 1 }),
      ]),
    }),
  ],
}
