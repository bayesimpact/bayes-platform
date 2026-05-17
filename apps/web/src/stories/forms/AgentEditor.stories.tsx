import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import type { Agent } from "@/common/features/agents/agents.models"
import type { Project } from "@/common/features/projects/projects.models"
import { withRedux } from "@/stories/decorators"
import { mergeSeeds, seed } from "@/stories/seed"
import { AgentEditorWithoutTrigger } from "@/studio/features/agents/components/AgentEditor"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"

const mockProject: Project = {
  id: "proj-1",
  name: "Mock Project",
  organizationId: "org-1",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  featureFlags: [],
  agentCategories: [
    { id: "category-1", name: "Billing" },
    { id: "category-2", name: "Support" },
  ],
}

const mockDocumentTags: DocumentTag[] = [
  {
    id: "tag-1",
    name: "Product",
    childrenIds: [],
    organizationId: "org-1",
    projectId: "proj-1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "tag-2",
    name: "Pricing",
    childrenIds: [],
    organizationId: "org-1",
    projectId: "proj-1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

const mockOutputJsonSchema = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const, description: "Short title for the item" },
    summary: { type: "string" as const, description: "One-sentence summary" },
  },
  required: ["title"],
}

const baseAgent = {
  projectId: "proj-1",
  name: "Helpful Assistant",
  defaultPrompt:
    "You are a helpful assistant. Answer the user's questions clearly using the available context.",
  model: AgentModel.Gemini25Flash,
  temperature: 0.2,
  locale: AgentLocale.EN,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  projectAgentCategoryIds: [],
  usedProjectAgentCategoryIds: [],
}

const mockConversationAgent: Agent = {
  ...baseAgent,
  id: "agent-conv-1",
  type: "conversation",
  documentTagIds: ["tag-1"],
  projectAgentCategoryIds: ["category-1"],
  usedProjectAgentCategoryIds: ["category-1"],
  documentsRagMode: DocumentsRagMode.Tags,
  greetingMessage: "Hi! How can I help you today?",
}

const mockExtractionAgent: Agent = {
  ...baseAgent,
  id: "agent-ext-1",
  name: "Document Extractor",
  type: "extraction",
  documentTagIds: [],
  documentsRagMode: DocumentsRagMode.None,
  outputJsonSchema: mockOutputJsonSchema,
  greetingMessage: null,
}

const mockFormAgent: Agent = {
  ...baseAgent,
  id: "agent-form-1",
  name: "Intake Form Agent",
  type: "form",
  documentTagIds: [],
  documentsRagMode: DocumentsRagMode.None,
  outputJsonSchema: mockOutputJsonSchema,
  greetingMessage: "Welcome — let's get started. I'll ask a few questions.",
}

const meta = {
  title: "forms/AgentEditor",
  component: AgentEditorWithoutTrigger,
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.studio.documentTags(mockDocumentTags),
      ),
    }),
  ],
  parameters: { layout: "fullscreen" },
  args: {
    onClose: fn(),
  },
} satisfies Meta<typeof AgentEditorWithoutTrigger>

export default meta
type Story = StoryObj<typeof meta>

export const ConversationEdit: Story = {
  args: {
    agent: mockConversationAgent,
  },
}

export const ExtractionEdit: Story = {
  args: {
    agent: mockExtractionAgent,
  },
}

export const FormEdit: Story = {
  args: {
    agent: mockFormAgent,
  },
}
