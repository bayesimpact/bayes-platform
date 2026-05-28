import { DocumentsRagMode } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import {
  type AgentSubAgentFormValue,
  AgentSubAgentsTab,
} from "@/studio/features/agents/components/AgentSubAgentsTab"

const organization = organizationFactory.build()
const project = projectFactory.transient({ organization }).build()

const masterAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Workspace Copilot",
  documentsRagMode: DocumentsRagMode.All,
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

const intakeAgent = agentFactory.transient({ project }).build({
  type: "form",
  name: "Intake Form",
  documentsRagMode: DocumentsRagMode.None,
})

const draftingAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Drafting Assistant",
  defaultPrompt: "Prepare concise drafts from approved context and prior decisions.",
  documentsRagMode: DocumentsRagMode.None,
})

const agents = [masterAgent, resourceAgent, policyAgent, intakeAgent, draftingAgent]

type StoryArgs = {
  value: AgentSubAgentFormValue[]
}

function StatefulStory({ value: initialValue }: StoryArgs) {
  const [value, setValue] = useState(initialValue)
  return (
    <div className="mx-auto max-w-5xl p-6">
      <AgentSubAgentsTab
        parentAgentId={masterAgent.id}
        agents={agents}
        value={value}
        onChange={setValue}
      />
    </div>
  )
}

const meta = {
  title: "routes/studio/project/agent/AgentSubAgentsTab",
  component: StatefulStory,
  parameters: { layout: "fullscreen" },
  args: {
    value: [],
  },
} satisfies Meta<typeof StatefulStory>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithSubAgents: Story = {
  args: {
    value: [
      {
        id: "sub-agent-resource",
        agentId: resourceAgent.id,
        toolName: "ask_resource_navigator",
        description: "Route resource lookup and eligibility questions to Resource Navigator.",
        enabled: true,
      },
      {
        id: "sub-agent-policy",
        agentId: policyAgent.id,
        toolName: "ask_policy_analyst",
        description: "Use Policy Analyst for questions that need regulatory or policy framing.",
        enabled: false,
      },
    ],
  },
}

export const NoAvailableConversationAgents: Story = {
  args: {
    value: [
      {
        id: "sub-agent-resource",
        agentId: resourceAgent.id,
        toolName: "ask_resource_navigator",
        description: "Route resource lookup and eligibility questions to Resource Navigator.",
        enabled: true,
      },
      {
        id: "sub-agent-policy",
        agentId: policyAgent.id,
        toolName: "ask_policy_analyst",
        description: "Use Policy Analyst for questions that need regulatory or policy framing.",
        enabled: true,
      },
      {
        id: "sub-agent-drafting",
        agentId: draftingAgent.id,
        toolName: "ask_drafting_assistant",
        description: "Use Drafting Assistant for short operational drafts.",
        enabled: true,
      },
    ],
  },
}
