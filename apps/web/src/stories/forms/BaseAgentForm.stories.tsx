import { DocumentsRagMode } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { agentFactory, agentOutputJsonSchemaFactory } from "@/common/features/agents/agent.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import {
  projectAgentCategoryFactory,
  projectFactory,
} from "@/common/features/projects/projects.factory"
import { withRedux } from "@/stories/decorators"
import { mergeSeeds, seed } from "@/stories/seed"
import { BaseAgentForm } from "@/studio/features/agents/components/BaseAgentForm"
import { documentTagFactory } from "@/studio/features/document-tags/document-tags.factory"

const organization = organizationFactory.build()
const billingCategory = projectAgentCategoryFactory.build({ name: "Billing" })
const supportCategory = projectAgentCategoryFactory.build({ name: "Support" })
const agentCategories = [billingCategory, supportCategory]
const project = projectFactory.transient({ organization }).build({ agentCategories })
const projectWithoutAgentCategories = projectFactory
  .transient({ organization })
  .build({ agentCategories: [] })

const productTag = documentTagFactory.transient({ project }).build({ name: "Product" })
const pricingTag = documentTagFactory.transient({ project }).build({ name: "Pricing" })
const supportTag = documentTagFactory.transient({ project }).build({ name: "Support" })
const documentTags = [productTag, pricingTag, supportTag]

const mockOutputJsonSchema = agentOutputJsonSchemaFactory.build({
  properties: {
    title: { type: "string", description: "Short title for the item" },
    summary: { type: "string", description: "One-sentence summary" },
  },
  required: ["title"],
})

const conversationAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Helpful Assistant",
  documentTagIds: [productTag.id],
  documentsRagMode: DocumentsRagMode.Tags,
  projectAgentCategoryIds: [billingCategory.id],
  usedProjectAgentCategoryIds: [billingCategory.id],
  greetingMessage: "Hi! How can I help you today?",
})

const extractionAgent = agentFactory.transient({ project }).build({
  type: "extraction",
  name: "Document Extractor",
  documentsRagMode: DocumentsRagMode.None,
  outputJsonSchema: mockOutputJsonSchema,
  greetingMessage: null,
})

const formAgent = agentFactory.transient({ project }).build({
  type: "form",
  name: "Intake Form Agent",
  documentsRagMode: DocumentsRagMode.None,
  outputJsonSchema: mockOutputJsonSchema,
  greetingMessage: "Welcome — let's get started. I'll ask a few questions.",
})

const meta = {
  title: "forms/BaseAgentForm",
  component: BaseAgentForm,
  decorators: [
    withRedux({
      state: mergeSeeds(seed.currentProject(project), seed.studio.documentTags(documentTags)),
    }),
  ],
  parameters: { layout: "padded" },
  args: {
    documentTags,
    projectAgentCategories: project.agentCategories,
    onSubmit: fn(),
  },
} satisfies Meta<typeof BaseAgentForm>

export default meta
type Story = StoryObj<typeof meta>

export const ConversationEdit: Story = {
  args: {
    agentType: "conversation",
    editableAgent: conversationAgent,
  },
}

export const ConversationEditWithoutProjectCategories: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(projectWithoutAgentCategories),
        seed.studio.documentTags(documentTags),
      ),
    }),
  ],
  args: {
    agentType: "conversation",
    editableAgent: {
      ...conversationAgent,
      projectAgentCategoryIds: [],
      usedProjectAgentCategoryIds: [],
    },
    projectAgentCategories: [],
  },
}

export const ConversationCreate: Story = {
  args: {
    agentType: "conversation",
    editableAgent: undefined,
  },
}

export const ExtractionEdit: Story = {
  args: {
    agentType: "extraction",
    editableAgent: extractionAgent,
  },
}

export const ExtractionCreate: Story = {
  args: {
    agentType: "extraction",
    editableAgent: undefined,
  },
}

export const FormEdit: Story = {
  args: {
    agentType: "form",
    editableAgent: formAgent,
  },
}

export const FormCreate: Story = {
  args: {
    agentType: "form",
    editableAgent: undefined,
  },
}
