import { createAsyncThunk } from "@reduxjs/toolkit"
import { getCurrentId } from "@/common/features/helpers"
import type { RootState, ThunkExtraArg } from "@/common/store"
import type { CreatedInvitations, PendingInvitations } from "./invitations.models"
import type {
  CreateInvitationsParams,
  InvitationTarget,
  ScopedInvitationTarget,
} from "./invitations.spi"

type ThunkConfig = { state: RootState; extra: ThunkExtraArg }

/** The admin routes nest under the current organization and project. */
const scopeTarget = (state: RootState, target: InvitationTarget): ScopedInvitationTarget => ({
  targetType: target.targetType,
  targetId: target.targetId,
  organizationId: getCurrentId({ state, name: "organizationId" }),
  projectId: getCurrentId({ state, name: "projectId" }),
})

export const createInvitations = createAsyncThunk<
  CreatedInvitations,
  CreateInvitationsParams,
  ThunkConfig
>(
  "invitations/createMany",
  async ({ emails, role, ...target }, { extra: { services }, getState }) =>
    await services.invitations.createMany({ ...scopeTarget(getState(), target), emails, role }),
)

export const listInvitationsForTarget = createAsyncThunk<
  PendingInvitations,
  InvitationTarget,
  ThunkConfig
>(
  "invitations/listForTarget",
  async (target, { extra: { services }, getState }) =>
    await services.invitations.listForTarget(scopeTarget(getState(), target)),
)

/** The target tells the listeners which list of pending invitations to refresh. */
export const revokeInvitation = createAsyncThunk<
  void,
  InvitationTarget & { invitationId: string },
  ThunkConfig
>(
  "invitations/revokeOne",
  async ({ invitationId, ...target }, { extra: { services }, getState }) =>
    await services.invitations.revokeOne({ ...scopeTarget(getState(), target), invitationId }),
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
