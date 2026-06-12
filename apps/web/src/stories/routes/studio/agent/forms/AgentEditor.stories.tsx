import { DocumentsRagMode } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { agentFactory, agentOutputJsonSchemaFactory } from "@/common/features/agents/agent.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import {
  projectAgentSessionCategoryFactory,
  projectFactory,
} from "@/common/features/projects/projects.factory"
import { withRedux } from "@/stories/decorators"
import { mergeSeeds, seed } from "@/stories/seed"
import { AgentEditorWithoutTrigger } from "@/studio/features/agents/components/AgentEditor"
import { documentTagFactory } from "@/studio/features/document-tags/document-tags.factory"

const organization = organizationFactory.build()
const billingCategory = projectAgentSessionCategoryFactory.build({ name: "Billing" })
const supportCategory = projectAgentSessionCategoryFactory.build({ name: "Support" })
const project = projectFactory
  .transient({ organization })
  .build({ agentSessionCategories: [billingCategory, supportCategory] })
const projectWithOrchestration = {
  ...project,
  featureFlags: ["agent-orchestration" as const],
}

const productTag = documentTagFactory.transient({ project }).build({ name: "Product" })
const pricingTag = documentTagFactory.transient({ project }).build({ name: "Pricing" })
const documentTags = [productTag, pricingTag]

const mockOutputJsonSchema = agentOutputJsonSchemaFactory.build()

const conversationAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Helpful Assistant",
  documentTagIds: [productTag.id],
  documentsRagMode: DocumentsRagMode.Tags,
  projectAgentSessionCategoryIds: [billingCategory.id],
  usedProjectAgentSessionCategoryIds: [billingCategory.id],
  greetingMessage: "Hi! How can I help you today?",
})

const resourceAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Resource Navigator",
  defaultPrompt: "Find relevant services, contacts, and eligibility details.",
  documentsRagMode: DocumentsRagMode.None,
})

const policyAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Policy Analyst",
  defaultPrompt: "Interpret policy documents and summarize operational constraints.",
  documentsRagMode: DocumentsRagMode.Tags,
})

const extractionAgent = agentFactory.transient({ project }).build({
  type: "extraction",
  name: "Document Extractor",
  documentsRagMode: DocumentsRagMode.None,
  outputJsonSchema: mockOutputJsonSchema,
  greetingMessage: undefined,
})

const formAgent = agentFactory.transient({ project }).build({
  type: "form",
  name: "Intake Form Agent",
  documentsRagMode: DocumentsRagMode.None,
  outputJsonSchema: mockOutputJsonSchema,
  greetingMessage: "Welcome — let's get started. I'll ask a few questions.",
})

const meta = {
  title: "routes/studio/project/agent/AgentEditor",
  component: AgentEditorWithoutTrigger,
  decorators: [
    withRedux({
      state: mergeSeeds(seed.currentProject(project), seed.studio.documentTags(documentTags)),
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
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(projectWithOrchestration),
        seed.studio.documentTags(documentTags),
        seed.agents([conversationAgent, resourceAgent, policyAgent]),
      ),
    }),
  ],
  args: {
    agent: conversationAgent,
  },
}

export const ExtractionEdit: Story = {
  args: {
    agent: extractionAgent,
  },
}

export const FormEdit: Story = {
  args: {
    agent: formAgent,
  },
}
