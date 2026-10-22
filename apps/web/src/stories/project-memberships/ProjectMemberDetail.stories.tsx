import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ComponentProps, useState } from "react"
import { expect, fn, userEvent, within } from "storybook/test"
import type { MemberResourceRoles } from "@/studio/features/project-memberships/components/member-detail/member-detail.models"
import { ProjectMemberDetail } from "@/studio/features/project-memberships/components/member-detail/ProjectMemberDetail"
import { mockCurrentUserId } from "./fixtures"
import {
  mockAgents,
  mockCampaigns,
  mockDetailMember,
  mockOwnerWorkspace,
  mockSelfMember,
  mockWorkspace,
  permissionsOf,
  readOnly,
  withoutRoles,
} from "./member-detail-fixtures"

type Props = ComponentProps<typeof ProjectMemberDetail>

/**
 * Keeps the resources in local state so that adding or removing a role shows on the page, as it
 * will once the API answers. The handlers passed as args still run, so a story can make them fail.
 */
function InteractiveDetail(props: Props) {
  const [resources, setResources] = useState({
    workspace: props.workspace,
    agents: props.agents,
    campaigns: props.campaigns,
  })

  const update = (
    target: MemberResourceRoles,
    change: (entry: MemberResourceRoles) => MemberResourceRoles,
  ) => {
    const apply = (entry: MemberResourceRoles) =>
      entry.kind === target.kind && entry.resourceId === target.resourceId ? change(entry) : entry
    setResources((current) => ({
      workspace: apply(current.workspace),
      agents: current.agents.map(apply),
      campaigns: current.campaigns.map(apply),
    }))
  }

  return (
    <ProjectMemberDetail
      {...props}
      {...resources}
      onAddRole={async (resource, roleKey) => {
        await props.onAddRole(resource, roleKey)
        update(resource, (entry) => {
          const role = entry.grantableRoles.find((candidate) => candidate.key === roleKey)
          const roles = role ? [...entry.roles, role] : entry.roles
          return { ...entry, roles, permissions: permissionsOf(roles) }
        })
      }}
      onRemoveRole={async (resource, roleKey) => {
        await props.onRemoveRole(resource, roleKey)
        update(resource, (entry) => {
          const roles = entry.roles.filter((role) => role.key !== roleKey)
          return { ...entry, roles, permissions: permissionsOf(roles) }
        })
      }}
    />
  )
}

const meta = {
  title: "project-memberships/ProjectMemberDetail",
  component: ProjectMemberDetail,
  parameters: { layout: "fullscreen" },
  render: (args) => <InteractiveDetail {...args} />,
  args: {
    member: mockDetailMember,
    currentUserId: mockCurrentUserId,
    workspace: mockWorkspace,
    agents: mockAgents,
    campaigns: mockCampaigns,
    onAddRole: fn(async () => {}),
    onRemoveRole: fn(async () => {}),
    onBack: fn(),
  },
} satisfies Meta<typeof ProjectMemberDetail>

export default meta
type Story = StoryObj<typeof meta>

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body)

/** A member with roles on the workspace, two of its agents and a campaign, as a manager sees them. */
export const ManageRoles: Story = {}

/** A member who only holds workspace roles and never signed in. */
export const WorkspaceRolesOnly: Story = {
  args: {
    member: { ...mockDetailMember, userHasSignedIn: false },
    agents: withoutRoles(mockAgents),
    campaigns: withoutRoles(mockCampaigns),
  },
}

/** The add menu of an agent offers only the agent roles the member does not hold. */
export const AddAgentRole: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "Add a role on Scheduling Bot" }),
    )
    await body(canvasElement).findByRole("menu")
  },
}

/** Removing a role asks for a confirmation. */
export const RemoveRole: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getAllByRole("button", {
        name: "Remove Project Member",
      })[0] as HTMLElement,
    )
    await body(canvasElement).findByRole("dialog")
  },
}

/** The API refuses the removal: the dialog stays open and says why. */
export const RemoveRoleFails: Story = {
  args: {
    onRemoveRole: fn(async () => {
      throw new Error("You no longer have the permission to change this member's roles.")
    }),
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Remove Agent Admin" }))
    const dialog = within(await body(canvasElement).findByRole("dialog"))
    await userEvent.click(dialog.getByRole("button", { name: "Remove" }))
    await expect(await dialog.findByRole("alert")).toBeInTheDocument()
  },
}

/** The member owns the workspace: that role is never removed here, and its tooltip says why. */
export const Owner: Story = {
  args: { workspace: mockOwnerWorkspace },
}

/** The viewer's own page: every role shows, none can be changed. */
export const MyOwnPage: Story = {
  args: { member: mockSelfMember },
}

/** A viewer who may read members but change no role. */
export const ReadOnly: Story = {
  args: {
    workspace: { ...mockWorkspace, canManage: false },
    agents: readOnly(mockAgents),
    campaigns: readOnly(mockCampaigns),
  },
}

/** A workspace with no agents and no review campaigns yet. */
export const EmptyWorkspace: Story = {
  args: { agents: [], campaigns: [] },
}
