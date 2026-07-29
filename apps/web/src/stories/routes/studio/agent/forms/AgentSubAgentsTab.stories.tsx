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
})

const resourceAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Resource Navigator",
})

const policyAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Policy Analyst",
})

// A conversation agent with the fillForm tool enabled — still a valid sub-agent candidate.
const intakeAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Intake Assistant",
})

const draftingAgent = agentFactory.transient({ project }).build({
  type: "conversation",
  name: "Drafting Assistant",
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
      {
        id: "sub-agent-intake",
        agentId: intakeAgent.id,
        toolName: "ask_intake_assistant",
        description: "Delegate structured intake questions to Intake Assistant.",
        enabled: true,
      },
    ],
  },
}
