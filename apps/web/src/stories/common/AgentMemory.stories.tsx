import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { agentMemoryFactory } from "@/common/features/agents/agent-memories/agent-memories.factory"
import type { AgentMemoryDecision } from "@/common/features/agents/agent-memories/agent-memories.models"
import type { IAgentMemoriesSpi } from "@/common/features/agents/agent-memories/agent-memories.spi"
import { AgentMemoryPanel } from "@/common/features/agents/agent-memories/components/AgentMemoryPanel"
import { MemoryToolCard } from "@/common/features/agents/agent-memories/components/MemoryToolCard"
import { buildDecorator } from "@/stories/decorators"
import { seed } from "@/stories/seed"

const savedFact = agentMemoryFactory.build({ content: "Prefers short answers" })
const firstProposal = agentMemoryFactory.pending().build({ content: "Works on weekends" })
const secondProposal = agentMemoryFactory.pending().build({ content: "Likes bullet points" })

function buildMockAgentMemoriesService(): IAgentMemoriesSpi {
  return {
    getAll: fn(async () => [savedFact, firstProposal, secondProposal]),
    deleteOne: fn(async () => ({ success: true as const })),
    deleteAll: fn(async () => ({ success: true as const })),
    resolveProposals: fn(async (_scope, decisions: AgentMemoryDecision[]) =>
      decisions
        .filter((decision) => decision.decision === "save")
        .map((decision) => {
          const proposal = decision.memoryId === firstProposal.id ? firstProposal : secondProposal
          return {
            ...proposal,
            status: "saved" as const,
            content: decision.content ?? proposal.content,
          }
        }),
    ),
  }
}

type Args = { withProposals: boolean }

const meta = {
  title: "common/AgentMemory",
  parameters: { layout: "padded" },
  args: { withProposals: true },
  argTypes: { withProposals: { control: "boolean" } },
  decorators: [
    buildDecorator<Args>(({ withProposals }) => ({
      state: seed.agentMemories(
        withProposals ? [savedFact, firstProposal, secondProposal] : [savedFact],
      ),
      services: { agentMemories: buildMockAgentMemoriesService() },
    })),
  ],
  render: ({ withProposals }: Args) => (
    <div className="max-w-xl">
      <MemoryToolCard
        toolCall={{
          id: "tool-call-1",
          result: {
            memories: [
              { id: savedFact.id, content: savedFact.content, status: "saved" },
              ...(withProposals
                ? [firstProposal, secondProposal].map((memory) => ({
                    id: memory.id,
                    content: memory.content,
                    status: "pending" as const,
                  }))
                : []),
            ],
          },
        }}
      />
    </div>
  ),
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

/** The agent saved what the user asked for and proposes two inferred facts. */
export const ApprovalCard: Story = {}

/** Only a fact the user asked to remember: no question, just the mark. */
export const SavedOnly: Story = { args: { withProposals: false } }

/** The header button and the sheet listing what the agent remembers. */
export const Panel: Story = {
  render: () => <AgentMemoryPanel />,
}
