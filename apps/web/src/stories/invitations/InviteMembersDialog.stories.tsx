import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { InviteMembersDialog } from "@/studio/features/invitations/components/invite-members/InviteMembersDialog"
import type {
  InviteRoleCatalog,
  InviteTarget,
} from "@/studio/features/invitations/components/invite-members/invite-members.models"
import { mockGrantableProjectRoles } from "../project-memberships/fixtures"
import { mockAgentRoles, mockCampaignRoles } from "../project-memberships/member-detail-fixtures"

/** Owner roles are set at creation, never given by an invitation. */
const roles: InviteRoleCatalog = {
  workspace: mockGrantableProjectRoles,
  agent: mockAgentRoles.filter((role) => role.key !== "agent_owner"),
  campaign: mockCampaignRoles,
}

const agents: InviteTarget[] = [
  { id: "agent-1", name: "Helpful Assistant", detail: "Conversation", canInvite: true },
  { id: "agent-2", name: "Scheduling Bot", detail: "Conversation", canInvite: true },
  { id: "agent-3", name: "Intake Form Agent", detail: "Extraction", canInvite: true },
]

const campaigns: InviteTarget[] = [
  { id: "campaign-1", name: "Pilot review", detail: "Active", canInvite: true },
  { id: "campaign-2", name: "Spring review", detail: "Draft", canInvite: true },
]

const manyAgents: InviteTarget[] = [
  "Helpful Assistant",
  "Scheduling Bot",
  "Intake Form Agent",
  "Product FAQ",
  "Pricing Helper",
  "Support Triage",
  "Onboarding Guide",
  "Release Notes Writer",
  "Feedback Summarizer",
  "Meeting Notes",
  "Glossary Bot",
  "Policy Finder",
].map((name, index) => ({
  id: `agent-${index + 1}`,
  name,
  detail: index % 3 === 2 ? "Extraction" : "Conversation",
  canInvite: true,
}))

const meta = {
  title: "invitations/InviteMembersDialog",
  component: InviteMembersDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: fn(),
    workspaceName: "Demo project",
    roles,
    agents,
    campaigns,
    existingMemberEmails: [],
    onOpenMember: fn(),
    onSubmit: fn(async () => {}),
  },
} satisfies Meta<typeof InviteMembersDialog>

export default meta
type Story = StoryObj<typeof meta>

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

/** Just opened: plain member by default, no agent picked. */
export const Empty: Story = {}

/** The case of the issue: two newcomers, member of the workspace and of two of its agents. */
export const MembersWithAgents: Story = {
  args: {
    defaultValues: {
      emails: ["avery@example.org", "jordan@example.org"],
      workspaceRoleKey: "project_member",
      agents: [
        { targetId: "agent-1", roleKey: "agent_member" },
        { targetId: "agent-2", roleKey: "agent_admin" },
      ],
    },
  },
}

/** Admin of the workspace: admin of every agent, so the agent list gives way to a note. */
export const WorkspaceAdmin: Story = {
  args: {
    defaultValues: {
      emails: ["avery@example.org"],
      workspaceRoleKey: "project_admin",
    },
  },
}

/** A tester and a reviewer on campaigns, on top of an agent. The campaign section opens. */
export const WithCampaigns: Story = {
  args: {
    defaultValues: {
      emails: ["avery@example.org"],
      workspaceRoleKey: "project_member",
      agents: [{ targetId: "agent-1", roleKey: "agent_member" }],
      campaigns: [{ targetId: "campaign-1", roleKey: "review_campaign_tester" }],
    },
  },
}

/** The inviter is admin of some agents only: the others show, disabled, with the reason. */
export const PartialPermissions: Story = {
  args: {
    agents: agents.map((agent) => ({ ...agent, canInvite: agent.id === "agent-1" })),
    campaigns: campaigns.map((campaign) => ({ ...campaign, canInvite: false })),
    defaultValues: {
      emails: ["avery@example.org"],
      agents: [{ targetId: "agent-1", roleKey: "agent_member" }],
    },
  },
}

/** One email belongs to a member: flagged, left out, with a link to their member page. */
export const AlreadyMember: Story = {
  args: {
    existingMemberEmails: ["cruz_braun84@hotmail.com"],
    defaultValues: {
      emails: ["avery@example.org", "cruz_braun84@hotmail.com"],
      agents: [{ targetId: "agent-1", roleKey: "agent_member" }],
    },
  },
}

/** A workspace with many agents: a search box narrows the list. The dialog scrolls, the footer stays. */
export const ManyAgents: Story = {
  args: {
    agents: manyAgents,
    defaultValues: {
      emails: ["avery@example.org"],
      agents: [{ targetId: "agent-4", roleKey: "agent_member" }],
    },
  },
}

/** A workspace without agents yet. */
export const NoAgents: Story = {
  args: { agents: [], campaigns: [] },
}

/** Pasting a list adds every address, and the submit button says how many people it invites. */
export const PasteSeveralEmails: Story = {
  play: async ({ canvasElement }) => {
    const page = body(canvasElement)
    await userEvent.type(
      page.getByLabelText("Emails"),
      "avery@example.org, jordan@example.org riley@example.org{enter}",
    )
    await expect(page.getByRole("button", { name: "Invite 3 people" })).toBeVisible()
  },
}

/** Submitting without an email says why, rather than disabling the button. */
export const SubmitWithoutEmail: Story = {
  play: async ({ canvasElement, args }) => {
    const page = body(canvasElement)
    await userEvent.click(page.getByRole("button", { name: "Invite" }))
    await expect(await page.findByText("Add at least one email.")).toBeVisible()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** The API refused the invitation: the dialog stays open with the reason. */
export const SubmitError: Story = {
  args: {
    ...MembersWithAgents.args,
    error: "Scheduling Bot was deleted in the meantime. Pick the agents again.",
  },
}
