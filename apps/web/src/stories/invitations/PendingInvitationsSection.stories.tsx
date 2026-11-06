import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { PendingInvitationsSection } from "@/studio/features/invitations/components/PendingInvitationsSection"
import { pendingInvitationFactory } from "@/studio/features/invitations/invitations.factory"

const HOUR = 3_600_000
const now = Date.now()

const agentsNamed = (names: string[]) =>
  names.map((name, index) => ({ id: `agent-${index + 1}`, name }))

const helpfulAssistant = { id: "agent-1", name: "Helpful Assistant" }

const memberWithAgents = pendingInvitationFactory.build({
  id: "invitation-member",
  invitedEmail: "avery@example.org",
  invitedAt: now - HOUR,
  role: "member",
  agents: agentsNamed(["Helpful Assistant", "Scheduling Bot"]),
})
const admin = pendingInvitationFactory.build({
  invitedEmail: "jordan@example.org",
  invitedAt: now - 5 * HOUR,
  role: "admin",
})
const memberWithoutAgent = pendingInvitationFactory.build({
  invitedEmail: "riley@example.org",
  invitedAt: now - 24 * HOUR,
  role: "member",
  agents: [],
})
const memberWithManyAgents = pendingInvitationFactory.build({
  invitedEmail: "casey@example.org",
  invitedAt: now - 48 * HOUR,
  role: "member",
  agents: agentsNamed([
    "Helpful Assistant",
    "Scheduling Bot",
    "Intake Form Agent",
    "Product FAQ",
    "Pricing Helper",
    "Support Triage",
  ]),
})
const agentInvitation = pendingInvitationFactory.build({
  id: "invitation-agent",
  targetType: "agent",
  targetId: helpfulAssistant.id,
  targetName: helpfulAssistant.name,
  invitedEmail: "morgan@example.org",
  invitedAt: now - 3 * HOUR,
  role: "member",
})

const meta = {
  title: "invitations/PendingInvitationsSection",
  component: PendingInvitationsSection,
  parameters: { layout: "fullscreen" },
  args: {
    title: "Pending invitations",
    description: "People invited to this workspace who have not answered yet.",
    invitations: [memberWithAgents, admin, memberWithoutAgent, memberWithManyAgents],
    onRevoke: fn(),
  },
} satisfies Meta<typeof PendingInvitationsSection>

export default meta
type Story = StoryObj<typeof meta>

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

/** The workspace members page: each card says the role and the agents the invitation gives. */
export const Workspace: Story = {}

/**
 * An agent's members page: its own invitations, and the workspace invitations that give it, with
 * all the agents they give.
 */
export const Agent: Story = {
  args: {
    description: "People invited to this agent who have not answered yet.",
    currentAgent: helpfulAssistant,
    invitations: [agentInvitation, memberWithAgents],
  },
}

/** On the workspace, deleting an invitation deletes all of it. */
export const DeleteInvitation: Story = {
  play: async ({ canvasElement, args }) => {
    const page = body(canvasElement)
    await userEvent.click(page.getAllByRole("button", { name: "Delete invitation" })[0]!)
    await expect(await page.findByText("Delete invitation?")).toBeInTheDocument()
    await userEvent.click(page.getByRole("button", { name: "Confirm" }))
    await expect(args.onRevoke).toHaveBeenCalledWith("invitation-member")
  },
}

/** On an agent, deleting a workspace invitation takes only this agent out of it. */
export const RemoveAgentFromInvitation: Story = {
  args: Agent.args,
  play: async ({ canvasElement, args }) => {
    const page = body(canvasElement)
    await userEvent.click(
      page.getByRole("button", { name: "Remove this agent from the invitation" }),
    )
    await expect(
      await page.findByText("Remove this agent from the invitation?"),
    ).toBeInTheDocument()
    await userEvent.click(page.getByRole("button", { name: "Confirm" }))
    await expect(args.onRevoke).toHaveBeenCalledWith("invitation-member")
  },
}
