import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { InviteMembersDialog } from "@/studio/features/invitations/components/invite-members/InviteMembersDialog"
import type { InviteAgent } from "@/studio/features/invitations/components/invite-members/invite-members.models"
import { mockGrantableProjectRoles } from "../project-memberships/fixtures"

const agents: InviteAgent[] = [
  { id: "agent-1", name: "Helpful Assistant", detail: "Conversation" },
  { id: "agent-2", name: "Scheduling Bot", detail: "Conversation" },
  { id: "agent-3", name: "Intake Form Agent", detail: "Extraction" },
]

const manyAgents: InviteAgent[] = [
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
}))

const meta = {
  title: "invitations/InviteMembersDialog",
  component: InviteMembersDialog,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: fn(),
    workspaceName: "Demo project",
    workspaceRoles: mockGrantableProjectRoles,
    agents,
    onSubmit: fn(async () => {}),
  },
} satisfies Meta<typeof InviteMembersDialog>

export default meta
type Story = StoryObj<typeof meta>

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

/** Waits for the dialog's opening animation, so typing reaches the field as a person's would. */
async function dialogOpened(canvasElement: HTMLElement) {
  const dialog = await body(canvasElement).findByRole("dialog")
  await Promise.all(dialog.getAnimations().map((animation) => animation.finished))
}

/** Goes from the picking screen to the confirmation screen. */
async function review(canvasElement: HTMLElement) {
  const page = body(canvasElement)
  await userEvent.click(page.getByRole("button", { name: /^Invite \d/ }))
  await expect(await page.findByText("Confirm the invitation")).toBeInTheDocument()
}

const usersWithAgents = {
  emails: ["avery@example.org", "jordan@example.org"],
  workspaceRoleKey: "project_member",
  agentIds: ["agent-1", "agent-2"],
}

/** Just opened: user of the workspace by default, no agent picked. */
export const Empty: Story = {}

/** The case of the issue: two newcomers, users of the workspace and of two of its agents. */
export const UsersWithAgents: Story = {
  args: { defaultValues: usersWithAgents },
}

/** Admin of the workspace: admin of every agent, so there is no agent to pick. */
export const WorkspaceAdmin: Story = {
  args: {
    defaultValues: { emails: ["avery@example.org"], workspaceRoleKey: "project_admin" },
  },
}

/** A workspace with many agents: a search box narrows the list. The dialog scrolls, the footer stays. */
export const ManyAgents: Story = {
  args: {
    agents: manyAgents,
    defaultValues: { emails: ["avery@example.org"], agentIds: ["agent-4"] },
  },
}

/** A workspace without agents yet. */
export const NoAgents: Story = {
  args: { agents: [] },
}

/** Pasting a list adds every address, and the submit button says how many people it invites. */
export const PasteSeveralEmails: Story = {
  play: async ({ canvasElement }) => {
    const page = body(canvasElement)
    await dialogOpened(canvasElement)
    await userEvent.type(
      page.getByLabelText("Emails"),
      "avery@example.org, jordan@example.org riley@example.org{enter}",
    )
    await expect(page.getByRole("button", { name: "Invite 3 people" })).toBeInTheDocument()
  },
}

/** Submitting without an email says why, rather than disabling the button. */
export const SubmitWithoutEmail: Story = {
  play: async ({ canvasElement, args }) => {
    const page = body(canvasElement)
    await userEvent.click(page.getByRole("button", { name: "Invite" }))
    await expect(await page.findByText("Add at least one email.")).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** The confirmation screen: who is invited, their role, their agents. Nothing is sent yet. */
export const Confirm: Story = {
  args: { defaultValues: usersWithAgents },
  play: async ({ canvasElement, args }) => {
    await review(canvasElement)
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Confirming an admin: every agent, with nothing picked. */
export const ConfirmWorkspaceAdmin: Story = {
  args: WorkspaceAdmin.args,
  play: async ({ canvasElement }) => review(canvasElement),
}

/** Back returns to the picking screen with every choice kept. */
export const BackKeepsChoices: Story = {
  args: { defaultValues: usersWithAgents },
  play: async ({ canvasElement }) => {
    const page = body(canvasElement)
    await review(canvasElement)
    await userEvent.click(page.getByRole("button", { name: "Back" }))
    await expect(page.getByRole("button", { name: "Invite 2 people" })).toBeInTheDocument()
    await expect(page.getByRole("checkbox", { name: /^Helpful Assistant/ })).toBeChecked()
  },
}

/** Confirm sends the invitation once, with the member role implied on each agent. */
export const ConfirmSends: Story = {
  args: { defaultValues: usersWithAgents },
  play: async ({ canvasElement, args }) => {
    const page = body(canvasElement)
    await review(canvasElement)
    await userEvent.click(page.getByRole("button", { name: "Confirm" }))
    await expect(args.onSubmit).toHaveBeenCalledWith(usersWithAgents)
  },
}

/** The API refused the invitation: the confirmation screen stays, with the reason. */
export const SubmitError: Story = {
  args: {
    defaultValues: usersWithAgents,
    error: "Scheduling Bot was deleted in the meantime. Go back and pick the agents again.",
  },
  play: async ({ canvasElement }) => review(canvasElement),
}
