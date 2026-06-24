import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { withRouter } from "storybook-addon-remix-react-router"
import { agentFactory } from "@/common/features/agents/agent.factory"
import {
  agentSessionMessageFactory,
  conversationAgentSessionFactory,
  formAgentSessionFactory,
} from "@/common/features/agents/agent-sessions/agent-session.factory"
import { TesterAgentSessionContent } from "@/tester/features/review-campaigns/components/TesterAgentSession"
import { withRedux } from "../../decorators"
import { mergeSeeds, seed } from "../../seed"
import { mockProject } from "../fixtures"
import { mockPerSessionQuestions, mockTesterContext } from "./fixtures"
import { buildMockTesterService } from "./mock-service"

const mockConversationAgent = agentFactory.transient({ project: mockProject }).build({
  id: "agent-1",
  name: "Helpful Assistant",
  type: "conversation",
  defaultPrompt: "You are a helpful assistant.",
  greetingMessage: "Hi! Ask me anything about your account.",
  locale: AgentLocale.EN,
  model: AgentModel.Gemini25Flash,
  temperature: 0.5,
  documentsRagMode: DocumentsRagMode.All,
})

const mockFormAgent = agentFactory.transient({ project: mockProject }).build({
  ...mockConversationAgent,
  id: "agent-2",
  name: "Intake Form Agent",
  type: "form",
  outputJsonSchema: {
    type: "object",
    required: ["reason"],
    properties: {
      reason: { type: "string", description: "Reason for contact" },
      priority: { type: "string", description: "Priority level" },
    },
  },
})

const mockConversationSession = conversationAgentSessionFactory
  .transient({ agent: mockConversationAgent })
  .build({
    id: "session-1",
    type: "live",
    createdAt: Date.now() - 5 * 60_000,
    updatedAt: Date.now(),
  })

const mockFormSession = formAgentSessionFactory.transient({ agent: mockFormAgent }).build({
  id: "session-2",
  type: "live",
  createdAt: Date.now() - 3 * 60_000,
  updatedAt: Date.now(),
  result: { reason: "Account access", priority: "Medium" },
})

const mockMessages = [
  agentSessionMessageFactory.build({
    id: "msg-1",
    role: "assistant",
    content: "Hi! Ask me anything about your account.",
  }),
  agentSessionMessageFactory.build({
    id: "msg-2",
    role: "user",
    content: "How do I reset my password?",
  }),
  agentSessionMessageFactory.build({
    id: "msg-3",
    role: "assistant",
    content:
      "Sure — go to Settings → Security and click 'Reset password'. You'll receive an email with a secure link.",
  }),
]

const baseStoryArgs = {
  campaignName: mockTesterContext.name,
  perSessionQuestions: mockPerSessionQuestions,
  ended: false,
}

const meta = {
  title: "review-campaigns/tester/pages/TesterAgentSessionRoute",
  component: TesterAgentSessionContent,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="flex flex-col h-dvh">
        <Story />
      </div>
    ),
    withRouter,
    withRedux({
      state: mergeSeeds(
        seed.currentProject(mockProject),
        seed.currentReviewCampaignId(mockTesterContext.id),
        seed.tester.context(mockTesterContext),
      ),
      services: { reviewCampaignsTester: buildMockTesterService() },
    }),
  ],
} satisfies Meta<typeof TesterAgentSessionContent>

export default meta
type Story = StoryObj<typeof meta>

export const ConversationWithMessages: Story = {
  args: {
    ...baseStoryArgs,
    agent: mockConversationAgent,
    agentSession: mockConversationSession,
    messages: mockMessages,
  },
}

export const ConversationEmpty: Story = {
  args: {
    ...baseStoryArgs,
    agent: mockConversationAgent,
    agentSession: mockConversationSession,
    messages: [],
  },
}

export const FormSessionWithResult: Story = {
  args: {
    ...baseStoryArgs,
    agent: mockFormAgent,
    agentSession: mockFormSession,
    messages: mockMessages,
  },
}
