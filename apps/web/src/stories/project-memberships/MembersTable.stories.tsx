import { Button } from "@caseai-connect/ui/shad/button"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { UserPlusIcon } from "lucide-react"
import { expect, fireEvent, fn, userEvent, within } from "storybook/test"
import { MembersTable } from "@/studio/features/project-memberships/components/members-table/MembersTable"
import {
  mockCurrentUserId,
  mockGrantableProjectRoles,
  mockManyMembers,
  mockMe,
  mockOwners,
} from "./fixtures"

const meta = {
  title: "project-memberships/MembersTable",
  component: MembersTable,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Members of Demo project</h1>
          <p className="text-muted-foreground">
            Everyone with access to this workspace, and the roles they hold on it.
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
  args: {
    scope: "project",
    members: mockManyMembers,
    roles: mockGrantableProjectRoles,
    currentUserId: mockCurrentUserId,
    canUpdateRoles: true,
    canRemoveMembers: true,
    onAddRoles: fn(async () => {}),
    onRemoveMembers: fn(async () => {}),
    onOpenMember: fn(),
    toolbarAction: (
      <Button size="sm" className="h-9">
        <UserPlusIcon />
        Invite admins
      </Button>
    ),
  },
} satisfies Meta<typeof MembersTable>

export default meta
type Story = StoryObj<typeof meta>

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

async function selectMembers(canvasElement: HTMLElement, count: number) {
  const checkboxes = within(canvasElement)
    .getAllByRole("checkbox", { name: /^Select (?!all)/ })
    .filter((checkbox) => !checkbox.hasAttribute("disabled"))
  for (const checkbox of checkboxes.slice(0, count)) {
    await userEvent.click(checkbox)
  }
}

async function selectOwnersOtherThanMe(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  for (const owner of mockOwners) {
    if (owner.userId === mockCurrentUserId) continue
    await userEvent.click(
      canvas.getByRole("checkbox", { name: `Select ${owner.userName ?? owner.userEmail}` }),
    )
  }
}

/** A manager's view: many members, some with several roles, some who never signed in. */
export const ManageMembers: Story = {}

/** A new workspace: the viewer is its only member, and cannot select themselves. */
export const OnlyMe: Story = {
  args: { members: [mockMe] },
}

/** The search and the filters leave no member. */
export const NoMatch: Story = {
  play: async ({ canvasElement }) => {
    // fireEvent rather than userEvent: typing from a play function does not reach the
    // controlled search field.
    fireEvent.change(within(canvasElement).getByPlaceholderText("Search by name or email…"), {
      target: { value: "nobody-by-that-name" },
    })
    await expect(await within(canvasElement).findByText("No member matches")).toBeVisible()
  },
}

/** Three members selected: the bulk action bar shows above the table. */
export const MembersSelected: Story = {
  play: async ({ canvasElement }) => {
    await selectMembers(canvasElement, 3)
  },
}

/** Adding roles to the selected members. */
export const AddRoles: Story = {
  play: async ({ canvasElement }) => {
    await selectMembers(canvasElement, 3)
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Add roles" }))
    const dialog = within(await body(canvasElement).findByRole("dialog"))
    await userEvent.click(dialog.getByLabelText("Project Admin"))
  },
}

/** Removing the selected members asks for a confirmation. */
export const RemoveMembers: Story = {
  play: async ({ canvasElement }) => {
    await selectMembers(canvasElement, 3)
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Remove" }))
    await body(canvasElement).findByRole("dialog")
  },
}

/** The API refuses the removal: the dialog stays open and says why. */
export const RemoveFails: Story = {
  args: {
    onRemoveMembers: fn(async () => {
      throw new Error("You no longer have the permission to remove members of this workspace.")
    }),
  },
  play: async ({ canvasElement }) => {
    await selectMembers(canvasElement, 2)
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Remove" }))
    const dialog = within(await body(canvasElement).findByRole("dialog"))
    await userEvent.click(dialog.getByRole("button", { name: "Remove" }))
    await expect(await dialog.findByRole("alert")).toBeInTheDocument()
  },
}

/**
 * The viewer is an admin and the workspace has one owner. With the owner selected, Remove is
 * disabled and its tooltip says why.
 */
export const LastOwnerProtected: Story = {
  args: {
    members: mockManyMembers
      .slice(0, 8)
      .map((member) =>
        member.userId === mockCurrentUserId
          ? { ...member, roles: [{ key: "project_admin", name: "Project Admin" }] }
          : member,
      ),
  },
  play: async ({ canvasElement }) => {
    await selectOwnersOtherThanMe(canvasElement)
  },
}

/** A viewer without `project.member.update` or `project.member.delete`: no selection, no action. */
export const ReadOnly: Story = {
  args: { canUpdateRoles: false, canRemoveMembers: false, toolbarAction: undefined },
}
