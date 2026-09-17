import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { organizationFactory } from "@/common/features/organizations/organization.factory"
import { projectFactory } from "@/common/features/projects/projects.factory"
import { buildDecorator } from "@/stories/decorators"
import { buildStudioData, studioStoryArgs } from "@/stories/routes/studio/helpers"
import { mergeSeeds, seed } from "@/stories/seed"
import {
  type AgentSubAgentFormValue,
  SubAgentsTab,
} from "@/studio/features/agents/agent-settings/components/tabs/SubAgentsTab"

const organization = organizationFactory.build()
const project = projectFactory.transient({ organization }).build()

// The tab only lists the agents by name and type, so their settings are irrelevant here.
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
      <SubAgentsTab
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
  // The available agents list reads the studio store: seed it like the agent route.
  decorators: [
    buildDecorator(() => ({
      state: mergeSeeds(
        buildStudioData(studioStoryArgs).baseSeeds,
        seed.agents(agents, { currentId: masterAgent.id }),
        // The available-agent rows read each agent's published settings.
        ...agents.map((agent) =>
          seed.studio.agentHistory({
            agentId: agent.id,
            versions: [agentSettingsFactory.transient({ agent }).build()],
          }),
        ),
      ),
    })),
  ],
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
        mode: "relay",
      },
      {
        id: "sub-agent-policy",
        agentId: policyAgent.id,
        toolName: "take_over_policy_interview",
        description: "Hand the conversation to Policy Analyst for the eligibility interview.",
        enabled: true,
        mode: "handoff",
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
        mode: "relay",
      },
      {
        id: "sub-agent-policy",
        agentId: policyAgent.id,
        toolName: "ask_policy_analyst",
        description: "Use Policy Analyst for questions that need regulatory or policy framing.",
        enabled: true,
        mode: "relay",
      },
      {
        id: "sub-agent-drafting",
        agentId: draftingAgent.id,
        toolName: "ask_drafting_assistant",
        description: "Use Drafting Assistant for short operational drafts.",
        enabled: true,
        mode: "relay",
      },
      {
        id: "sub-agent-intake",
        agentId: intakeAgent.id,
        toolName: "ask_intake_assistant",
        description: "Delegate structured intake questions to Intake Assistant.",
        enabled: true,
        mode: "relay",
      },
    ],
  },
}
