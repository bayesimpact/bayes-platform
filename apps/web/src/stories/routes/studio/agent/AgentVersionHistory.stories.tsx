import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { agentFactory, agentOutputJsonSchemaFactory } from "@/common/features/agents/agent.factory"
import type { Agent } from "@/common/features/agents/agents.models"
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
  instructions: "You are a helpful assistant.\nAnswer clearly and concisely.",
  model: AgentModel.Gemini25Flash,
  temperature: 0.7,
  locale: AgentLocale.EN,
  documentsRagMode: DocumentsRagMode.None,
  greetingMessage: undefined,
  outputJsonSchema: undefined,
})

/** Revisions ordered newest first, as returned by the history endpoint. */
const versions: Agent[] = [
  {
    ...baseAgent,
    revision: 4,
    instructions:
      "You are a helpful assistant.\nAnswer clearly and concisely.\nAlways cite your sources.",
    temperature: 0.3,
    documentsRagMode: DocumentsRagMode.All,
    updatedAt: Date.now() - 1000 * 60 * 60,
  },
  {
    ...baseAgent,
    revision: 3,
    instructions:
      "You are a helpful assistant.\nAnswer clearly and concisely.\nAlways cite your sources.",
    temperature: 0.3,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    ...baseAgent,
    revision: 2,
    model: AgentModel.Gemini25Pro,
    greetingMessage: "Hi! How can I help you today?",
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
  },
  {
    ...baseAgent,
    revision: 1,
    instructions: "You are a helpful assistant.",
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
  },
]

const schemaAgent = agentFactory.transient({ project }).build({
  type: "extraction",
  name: "Document Extractor",
  outputJsonSchema: agentOutputJsonSchemaFactory.build(),
})

const schemaVersions: Agent[] = [
  {
    ...schemaAgent,
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
    ...schemaAgent,
    revision: 1,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
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
  decorators: [withRedux({ state: seed.studio.agentHistory(versions) })],
}

export const SchemaChange: Story = {
  decorators: [withRedux({ state: seed.studio.agentHistory(schemaVersions) })],
}

export const SingleVersion: Story = {
  decorators: [withRedux({ state: seed.studio.agentHistory([{ ...baseAgent, revision: 1 }]) })],
}
