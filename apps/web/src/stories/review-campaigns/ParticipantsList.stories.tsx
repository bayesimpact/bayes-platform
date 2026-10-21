import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { pendingInvitationFactory } from "@/studio/features/invitations/invitations.factory"
import { ParticipantsList } from "@/studio/features/review-campaigns/components/ParticipantsList"
import { mockActiveCampaign, mockMemberships } from "./fixtures"

const meta = {
  title: "review-campaigns/ParticipantsList",
  component: ParticipantsList,
  parameters: { layout: "padded" },
  args: {
    onInvite: fn(),
    onRevoke: fn(),
    onRevokeInvitation: fn(),
  },
} satisfies Meta<typeof ParticipantsList>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    memberships: [],
    pendingInvitations: [],
  },
}

export const WithParticipants: Story = {
  args: {
    memberships: mockMemberships,
    pendingInvitations: pendingInvitationFactory.buildList(2, {
      targetType: "review_campaign",
      targetId: mockActiveCampaign.id,
      targetName: mockActiveCampaign.name,
      role: "tester",
    }),
  },
}

export const ClosedReadOnly: Story = {
  args: {
    memberships: mockMemberships,
    pendingInvitations: [],
    disabled: true,
  },
}
