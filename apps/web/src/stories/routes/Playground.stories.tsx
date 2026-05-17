import { AgentLocale, AgentModel, DocumentsRagMode } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ArrowLeftIcon, Trash2Icon } from "lucide-react"
import { withRouter } from "storybook-addon-remix-react-router"
import { FormResult } from "@/common/features/agents/agent-sessions/form/components/FormResult"
import type { FormAgentSession } from "@/common/features/agents/agent-sessions/form/form-agent-sessions.models"
import type { AgentSessionMessage as AgentSessionMessageType } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import { AgentSessionMessages } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/AgentSessionMessages"
import type { Agent } from "@/common/features/agents/agents.models"
import { withRedux } from "@/stories/decorators"
import { DotsBackground } from "@/studio/components/DotsBackground"

const mockAgent: Agent = {
  id: "agent-form-1",
  projectId: "proj-1",
  type: "form",
  name: "Intake Form Agent",
  defaultPrompt: "Collect intake details from the user.",
  greetingMessage: "Hi! I'll walk you through a short form.",
  model: AgentModel.Gemini25Flash,
  temperature: 0.2,
  locale: AgentLocale.EN,
  documentTagIds: [],
  documentsRagMode: DocumentsRagMode.None,
  projectAgentCategoryIds: [],
  usedProjectAgentCategoryIds: [],
  outputJsonSchema: {
    type: "object",
    properties: {
      firstName: { type: "string", description: "Given name" },
      lastName: { type: "string", description: "Family name" },
      email: { type: "string", description: "Contact email" },
      phone: { type: "string", description: "Phone number" },
      company: { type: "string", description: "Company name" },
      role: { type: "string", description: "Job title" },
      country: { type: "string", description: "Country" },
      city: { type: "string", description: "City" },
      postalCode: { type: "string", description: "Postal or zip code" },
      industry: { type: "string", description: "Industry" },
      teamSize: { type: "number", description: "Number of people in the team" },
      budget: { type: "number", description: "Planned budget" },
      startDate: { type: "string", description: "Project start date" },
      endDate: { type: "string", description: "Project end date" },
      notes: { type: "string", description: "Any extra notes" },
    },
    required: ["firstName", "email"],
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const mockSession: FormAgentSession = {
  id: "session-1",
  agentId: mockAgent.id,
  type: "playground",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  result: {
    firstName: "Alex",
    lastName: "Martin",
    email: "alex@example.com",
    company: "Acme",
    role: "PM",
    country: "France",
    city: "Lyon",
    industry: "Software",
    teamSize: 12,
  },
}

const mockMessages: AgentSessionMessageType[] = [
  {
    id: "m-1",
    role: "assistant",
    content: "Hi! I'll walk you through a short form. Let's start — what is your first name?",
    status: "completed",
  },
  { id: "m-2", role: "user", content: "Alex" },
  {
    id: "m-3",
    role: "assistant",
    content: "Great, thanks Alex. And your family name?",
    status: "completed",
  },
  { id: "m-4", role: "user", content: "Martin" },
  {
    id: "m-5",
    role: "assistant",
    content: "Perfect. What is the best email to reach you at?",
    status: "completed",
  },
  { id: "m-6", role: "user", content: "alex@example.com" },
  {
    id: "m-7",
    role: "assistant",
    content: "Noted. Which company are you with?",
    status: "completed",
  },
  { id: "m-8", role: "user", content: "Acme" },
  {
    id: "m-9",
    role: "assistant",
    content: "Got it — what is your role at Acme?",
    status: "completed",
  },
  { id: "m-10", role: "user", content: "PM" },
]

function PlaygroundLayout({
  agent,
  agentSession,
  messages,
}: {
  agent: Agent
  agentSession: FormAgentSession
  messages: AgentSessionMessageType[]
}) {
  return (
    <DotsBackground className="h-screen w-screen">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between border-b px-6 py-4 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="icon" className="rounded-full">
              <ArrowLeftIcon className="size-4" />
            </Button>
            <div>
              <div className="text-2xl font-semibold">Playground</div>
              <div className="text-sm text-muted-foreground">
                {agent.name} • Form • a few seconds ago
              </div>
            </div>
          </div>
          <Button variant="outline" size="icon">
            <Trash2Icon className="size-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0">
          <AgentSessionMessages
            session={agentSession}
            messages={messages}
            rightSlot={<FormResult agent={agent} agentSession={agentSession} />}
          />
        </div>
      </div>
    </DotsBackground>
  )
}

const meta = {
  title: "routes/Playground",
  component: PlaygroundLayout,
  parameters: { layout: "fullscreen" },
  decorators: [withRouter, withRedux()],
  args: {
    agent: mockAgent,
    agentSession: mockSession,
    messages: mockMessages,
  },
} satisfies Meta<typeof PlaygroundLayout>

export default meta
type Story = StoryObj<typeof meta>

export const FormAgent: Story = {}
