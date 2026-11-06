import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { PendingInvitationList } from "@/common/components/home/PendingInvitationList"
import { pendingInvitationFactory } from "@/studio/features/invitations/invitations.factory"

const workspace = {
  targetType: "project" as const,
  organizationName: "Acme Corp",
  projectName: "Demo project",
  targetName: "Demo project",
}

const agentsNamed = (names: string[]) =>
  names.map((name, index) => ({ id: `agent-${index + 1}`, name }))

const memberWithAgents = pendingInvitationFactory.build({
  ...workspace,
  id: "invitation-member",
  role: "member",
  agents: agentsNamed(["Helpful Assistant", "Scheduling Bot"]),
})

const meta = {
  title: "invitations/PendingInvitationList",
  component: PendingInvitationList,
  parameters: { layout: "padded" },
  args: {
    invitations: [memberWithAgents],
    onAccept: fn(),
    onDecline: fn(),
  },
} satisfies Meta<typeof PendingInvitationList>

export default meta
type Story = StoryObj<typeof meta>

/** The case of the issue: member of a workspace and of two of its agents, accepted at once. */
export const MemberWithAgents: Story = {}

/** An admin of the workspace is admin of every agent: no list of agents. */
export const WorkspaceAdmin: Story = {
  args: {
    invitations: [pendingInvitationFactory.build({ ...workspace, role: "admin" })],
  },
}

/** Many agents: the summary lists them all, since the invitee decides here. */
export const ManyAgents: Story = {
  args: {
    invitations: [
      pendingInvitationFactory.build({
        ...workspace,
        role: "member",
        agents: agentsNamed([
          "Helpful Assistant",
          "Scheduling Bot",
          "Intake Form Agent",
          "Product FAQ",
          "Pricing Helper",
          "Support Triage",
          "Onboarding Guide",
        ]),
      }),
    ],
  },
}

/** A member of the workspace with no agent yet. */
export const MemberWithoutAgent: Story = {
  args: {
    invitations: [pendingInvitationFactory.build({ ...workspace, role: "member", agents: [] })],
  },
}

/** Invitations sent before this change, to one agent or one review campaign. */
export const OlderInvitations: Story = {
  args: {
    invitations: [
      pendingInvitationFactory.build({
        targetType: "agent",
        organizationName: "Acme Corp",
        projectName: "Demo project",
        targetName: "Helpful Assistant",
        role: "member",
      }),
      pendingInvitationFactory.build({
        targetType: "review_campaign",
        organizationName: "Acme Corp",
        projectName: "Demo project",
        targetName: "Spring review",
        role: "tester",
      }),
    ],
  },
}

/** A full inbox: a workspace invitation next to older ones. */
export const Mixed: Story = {
  args: {
    invitations: [
      memberWithAgents,
      pendingInvitationFactory.build({ ...workspace, targetName: "Support", role: "admin" }),
      pendingInvitationFactory.build({
        targetType: "agent",
        organizationName: "Acme Corp",
        projectName: "Demo project",
        targetName: "Helpful Assistant",
        role: "member",
      }),
    ],
  },
}

/** Accepting sends the invitation's id once: everything it gives comes with it. */
export const Accept: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Accept/ }))
    await expect(args.onAccept).toHaveBeenCalledWith("invitation-member")
  },
}
