import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"

const meta = {
  title: "common/ConfirmDialog",
  component: ConfirmDialog,
  parameters: { layout: "centered" },
  args: {
    open: true,
    onConfirm: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof ConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

export const RemoveMember: Story = {
  args: {
    title: "Remove Alice Martin?",
    description: "This will remove the member from the agent. This action cannot be undone.",
    confirmLabel: "Remove",
  },
}

export const RevokeInvitation: Story = {
  args: {
    title: "Revoke alice@example.com?",
    description:
      "This participant will be removed from the campaign. This action cannot be undone.",
    confirmLabel: "Revoke",
  },
}

export const NoDescription: Story = {
  args: {
    title: "Remove this member?",
  },
}

export const DefaultConfirmLabel: Story = {
  name: "Default confirm label (falls back to «Remove»)",
  args: {
    title: "Remove Bob Smith?",
    description: "This will remove the member from the project. This action cannot be undone.",
  },
}
