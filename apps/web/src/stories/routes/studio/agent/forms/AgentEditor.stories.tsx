import { DocumentsRagMode } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { withRouter } from "storybook-addon-remix-react-router"
import { agentFactory, agentOutputJsonSchemaFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/settings/agent-settings.factory"
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
  projectAgentSessionCategoryIds: [billingCategory.id],
  usedProjectAgentSessionCategoryIds: [billingCategory.id],
})
const conversationAgentSettings = agentSettingsFactory
  .transient({ agent: conversationAgent })
  .build({
    documentsRagMode: DocumentsRagMode.Tags,
    greetingMessage: "Hi! How can I help you today?",
  })

// Same agent, but its newest settings revision is an unpublished draft: the version-history
// trigger in the editor header must mark it as a draft rather than looking live.
const conversationAgentDraftSettings = agentSettingsFactory
  .transient({ agent: conversationAgent })
  .build({
    revision: conversationAgentSettings.revision + 1,
    isDraft: true,
    documentsRagMode: DocumentsRagMode.Tags,
    greetingMessage: "Hi! How can I help you today?",
  })

const resourceAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Resource Navigator",
})

const policyAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Policy Analyst",
})

const extractionAgent = agentFactory.transient({ project }).build({
  type: "extraction",
  name: "Document Extractor",
})
const extractionAgentSettings = agentSettingsFactory.transient({ agent: extractionAgent }).build({
  documentsRagMode: DocumentsRagMode.None,
  outputJsonSchema: mockOutputJsonSchema,
  greetingMessage: undefined,
})

// A conversation agent with the fillForm tool enabled — the editor shows the Tools tab.
const fillFormAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Intake Assistant",
})
const fillFormAgentSettings = agentSettingsFactory
  .fillForm()
  .transient({ agent: fillFormAgent })
  .build({
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
        seed.studio.agentSettings([conversationAgentSettings]),
      ),
    }),
  ],
  args: {
    agent: conversationAgent,
    settings: conversationAgentSettings,
  },
}

export const ConversationEditDraft: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(projectWithOrchestration),
        seed.studio.documentTags(documentTags),
        seed.agents([conversationAgent, resourceAgent, policyAgent], {
          currentId: conversationAgent.id,
        }),
        seed.studio.agentSettings([conversationAgentDraftSettings, conversationAgentSettings]),
      ),
    }),
  ],
  args: {
    agent: conversationAgent,
    settings: conversationAgentDraftSettings,
  },
}

export const ExtractionEdit: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(project),
        seed.studio.documentTags(documentTags),
        seed.agents([extractionAgent], { currentId: extractionAgent.id }),
        seed.studio.agentSettings([extractionAgentSettings]),
      ),
    }),
  ],
  args: {
    agent: extractionAgent,
    settings: extractionAgentSettings,
  },
}

export const ConversationWithFillForm: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(project),
        seed.studio.documentTags(documentTags),
        seed.agents([fillFormAgent], { currentId: fillFormAgent.id }),
        seed.studio.agentSettings([fillFormAgentSettings]),
      ),
    }),
  ],
  args: {
    agent: fillFormAgent,
    settings: fillFormAgentSettings,
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
        seed.studio.agentSettings([conversationAgentSettings]),
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
    settings: conversationAgentSettings,
  },
}

export const ConversationWithFillFormAndMcpServers: Story = {
  decorators: [
    withRedux({
      state: mergeSeeds(
        seed.currentProject(projectWithMcp),
        seed.studio.documentTags(documentTags),
        seed.studio.mcpServers(mcpServers),
        seed.agents([fillFormAgent], { currentId: fillFormAgent.id }),
        seed.studio.agentSettings([fillFormAgentSettings]),
      ),
    }),
  ],
  args: {
    agent: {
      ...fillFormAgent,
      mcpServers: mcpServers.map((server) => ({
        id: server.id,
        name: server.name,
        enabled: true,
      })),
    },
    settings: fillFormAgentSettings,
  },
}
