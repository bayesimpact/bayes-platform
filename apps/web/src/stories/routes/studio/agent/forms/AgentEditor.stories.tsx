import { DocumentsRagMode } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { withRouter } from "storybook-addon-remix-react-router"
import { agentFactory, agentOutputJsonSchemaFactory } from "@/common/features/agents/agent.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import {
  projectAgentSessionCategoryFactory,
  projectFactory,
} from "@/common/features/projects/projects.factory"
import { withRedux } from "@/stories/decorators"
import { mergeSeeds, seed } from "@/stories/seed"
import { AgentEditor } from "@/studio/features/agents/components/AgentEditor"
import { documentTagFactory } from "@/studio/features/document-tags/document-tags.factory"
import { mcpServerFactory } from "@/studio/features/mcp-servers/mcp-servers.factory"

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
const projectWithMcp = {
  ...project,
  featureFlags: ["agent-mcp" as const],
}
const mcpServers = mcpServerFactory.transient({ project }).buildList(3)

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
  instructions: "Find relevant services, contacts, and eligibility details.",
  documentsRagMode: DocumentsRagMode.None,
})

const policyAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Policy Analyst",
  instructions: "Interpret policy documents and summarize operational constraints.",
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
  component: AgentEditor,
  decorators: [
    withRouter,
    withRedux({
      state: mergeSeeds(seed.currentProject(project), seed.studio.documentTags(documentTags)),
    }),
  ],
  parameters: { layout: "fullscreen" },
  args: {},
} satisfies Meta<typeof AgentEditor>

export default meta
type Story = StoryObj<typeof meta>

export const ConversationEdit: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(projectWithOrchestration),
        seed.studio.documentTags(documentTags),
        seed.agents([conversationAgent, resourceAgent, policyAgent], {
          currentId: conversationAgent.id,
        }),
      ),
    }),
  ],
  args: {
    agent: conversationAgent,
  },
}

export const ExtractionEdit: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(project),
        seed.studio.documentTags(documentTags),
        seed.agents([extractionAgent], { currentId: extractionAgent.id }),
      ),
    }),
  ],
  args: {
    agent: extractionAgent,
  },
}

export const FormEdit: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(project),
        seed.studio.documentTags(documentTags),
        seed.agents([formAgent], { currentId: formAgent.id }),
      ),
    }),
  ],
  args: {
    agent: formAgent,
  },
}

export const WithMcpServers: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(projectWithMcp),
        seed.studio.documentTags(documentTags),
        seed.studio.mcpServers(mcpServers),
        seed.agents([conversationAgent], { currentId: conversationAgent.id }),
      ),
    }),
  ],
  args: {
    agent: {
      ...conversationAgent,
      mcpServers: mcpServers.map((server) => ({
        id: server.id,
        name: server.name,
        enabled: true,
      })),
    },
  },
}

export const FormWithMcpServers: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(projectWithMcp),
        seed.studio.documentTags(documentTags),
        seed.studio.mcpServers(mcpServers),
        seed.agents([formAgent], { currentId: formAgent.id }),
      ),
    }),
  ],
  args: {
    agent: {
      ...formAgent,
      mcpServers: mcpServers.map((server) => ({
        id: server.id,
        name: server.name,
        enabled: true,
      })),
    },
  },
}
