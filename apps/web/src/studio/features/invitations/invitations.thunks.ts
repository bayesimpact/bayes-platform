import { createAsyncThunk } from "@reduxjs/toolkit"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { PendingInvitations } from "./invitations.models"
import type { CreateInvitationsParams, InvitationTarget } from "./invitations.spi"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

export const createInvitations = createAsyncThunk<
  PendingInvitations,
  CreateInvitationsParams,
  ThunkConfig
>(
  "invitations/createMany",
  async (params, { extra: { services } }) => await services.invitations.createMany(params),
)

export const listInvitationsForTarget = createAsyncThunk<
  PendingInvitations,
  InvitationTarget,
  ThunkConfig
>(
  "invitations/listForTarget",
  async (params, { extra: { services } }) => await services.invitations.listForTarget(params),
)

/** The target tells the listeners which list of pending invitations to refresh. */
export const revokeInvitation = createAsyncThunk<
  void,
  InvitationTarget & { invitationId: string },
  ThunkConfig
>(
  "invitations/revokeOne",
  async ({ invitationId }, { extra: { services } }) =>
    await services.invitations.revokeOne(invitationId),
)

export const acceptInvitation = createAsyncThunk<void, { invitationId: string }, ThunkConfig>(
  "invitations/acceptOne",
  async ({ invitationId }, { extra: { services } }) =>
    await services.invitations.acceptOne(invitationId),
)

export const declineInvitation = createAsyncThunk<void, { invitationId: string }, ThunkConfig>(
  "invitations/declineOne",
  async ({ invitationId }, { extra: { services } }) =>
    await services.invitations.declineOne(invitationId),
)
