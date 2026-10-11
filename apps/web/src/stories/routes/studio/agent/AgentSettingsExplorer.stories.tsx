import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory } from "@/common/features/agents/agent.factory"
import {
  agentOutputJsonSchemaFactory,
  agentSettingsFactory,
} from "@/common/features/agents/agent-settings/agent-settings.factory"
import type { AgentSettings } from "@/common/features/agents/agent-settings/agent-settings.models"
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
  locale: AgentLocale.EN,
  documentsRagMode: DocumentsRagMode.None,
  greetingMessage: undefined,
  outputJsonSchema: undefined,
})

/** Revisions ordered newest first, as returned by the history endpoint. */
const versions: AgentSettings[] = [
  {
    ...baseSettings,
    revision: 4,
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

/** The explorer reads the current agent id from the store, so both must be seeded together. */
function seedHistory(currentAgent: typeof agent, agentSettings: AgentSettings[]) {
  return mergeSeeds(
    seed.agents([currentAgent], { currentId: currentAgent.id }),
    seed.studio.agentHistory({ agentId: currentAgent.id, versions: agentSettings }),
  )
}

const meta = {
  title: "routes/studio/project/agent/AgentSettingsExplorer",
  component: AgentSettingsExplorer,
  render: () => (
    <div className="flex h-[600px] flex-col border">
      <AgentSettingsExplorer />
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
  decorators: [withRedux({ state: seedHistory(agent, [{ ...baseSettings, revision: 1 }]) })],
}
