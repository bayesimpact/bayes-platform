import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { PendingInvitations, PendingInvitationTargetType } from "./invitations.models"
import type {
  CreateInvitationsForTargetParams,
  ListInvitationsForTargetParams,
} from "./invitations.spi"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export type InvitationRefreshTarget = {
  targetType: PendingInvitationTargetType
  targetId: string
}

export const acceptInvitation = createAsyncThunk<void, { ticketId: string }, ThunkConfig>(
  "invitations/accept",
  async ({ ticketId }, { extra: { services } }) =>
    await services.invitations.acceptInvitation(ticketId),
)

export const createInvitationsForTarget = createAsyncThunk<
  PendingInvitations,
  CreateInvitationsForTargetParams & { refreshTarget?: InvitationRefreshTarget },
  ThunkConfig
>("invitations/createForTarget", async (params, { extra: { services } }) => {
  return await services.invitations.createForTarget({
    targetType: params.targetType,
    targetId: params.targetId,
    emails: params.emails,
    role: params.role,
  })
})

export const listInvitationsForTarget = createAsyncThunk<
  PendingInvitations,
  ListInvitationsForTargetParams,
  ThunkConfig
>("invitations/listForTarget", async (params, { extra: { services } }) => {
  return await services.invitations.listForTarget(params)
})

export const revokeInvitation = createAsyncThunk<
  void,
  { invitationId: string; refreshTarget?: InvitationRefreshTarget },
  ThunkConfig
>("invitations/revoke", async ({ invitationId }, { extra: { services } }) => {
  await services.invitations.revokeInvitation(invitationId)
})
