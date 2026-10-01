import type { RequestPayload, ResponseData, SuccessResponseDTO } from "../generic"
import { defineRoute } from "../helpers"
import type {
  CreateInvitationsRequestDto,
  CreateInvitationsResponseDto,
  ListInvitationsResponseDto,
} from "./invitations.dto"

export const InvitationsRoutes = {
  createMany: defineRoute<
    ResponseData<CreateInvitationsResponseDto>,
    RequestPayload<CreateInvitationsRequestDto>
  >({
    method: "post",
    path: "invitations",
  }),
  /** Pending invitations of a target. Query: `targetType`, `targetId`. */
  listForTarget: defineRoute<ResponseData<ListInvitationsResponseDto>>({
    method: "get",
    path: "invitations",
  }),
  revokeOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "delete",
    path: "invitations/:invitationId",
  }),
  listPendingMine: defineRoute<ResponseData<ListInvitationsResponseDto>>({
    method: "get",
    path: "invitations/mine",
  }),
  acceptOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "post",
    path: "invitations/:invitationId/accept",
  }),
  declineOne: defineRoute<ResponseData<SuccessResponseDTO>>({
    method: "post",
    path: "invitations/:invitationId/decline",
  }),
}
